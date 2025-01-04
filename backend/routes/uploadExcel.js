const express = require("express");
const multer = require("multer");
const xlsx = require("xlsx");
const fs = require("fs");
const { Pool } = require("pg");
const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 10000, 
});

const uploadDir = "./uploads";
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + "-" + file.originalname);
  },
});
const upload = multer({ storage: storage });

// Helper function to determine column types dynamically based on the data
function determineColumnTypes(data) {
  const columnTypes = {};
  data.forEach((row) => {
    Object.keys(row).forEach((col) => {
      if (columnTypes[col] === undefined) {
        if (typeof row[col] === "number") {
          columnTypes[col] = "FLOAT";
        } else if (typeof row[col] === "boolean") {
          columnTypes[col] = "BOOLEAN";
        } else {
          columnTypes[col] = "VARCHAR(255)";
        }
      }
    });
  });
  return columnTypes;
}

const router = express.Router();

// Route to handle file upload and process Excel data
router.post("/uploadExcel", upload.single("file"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  const { tableName, attributes } = req.body;

  if (!tableName || !attributes) {
    return res.status(400).json({ error: "Table name and attributes are required" });
  }

  const filePath = req.file.path;

  try {
    // Read Excel file
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const jsonData = xlsx.utils.sheet_to_json(sheet);

    const columns = attributes.split(",").map((attr) => attr.trim());
    const sheetColumns = Object.keys(jsonData[0]);

    // Check for missing columns in the Excel file
    const missingColumns = columns.filter((col) => !sheetColumns.includes(col));
    if (missingColumns.length > 0) {
      return res.status(400).json({
        error: `Missing columns in the Excel sheet: ${missingColumns.join(", ")}`,
      });
    }

    // Determine column types based on data
    const columnTypes = determineColumnTypes(jsonData);

    // Create table query
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS "${tableName}" (
        ${columns
          .map(
            (col) => `"${col}" ${columnTypes[col] || "VARCHAR(255)"}`
          )
          .join(", ")}
      )`;

    // Execute CREATE TABLE query
    db.query(createTableQuery, (err) => {
      if (err) {
        console.error("Error creating table:", err);
        fs.unlinkSync(filePath);
        return res.status(500).json({ error: "Failed to create table" });
      }

      // Prepare data for insertion
      const values = jsonData.map((row) => columns.map((col) => row[col]));

      // Insert data query
      const insertQuery = `
        INSERT INTO "${tableName}" (${columns.map(() => `"??"`).join(", ")}) 
        VALUES ${values.map(() => `(?)`).join(", ")}
      `;

      // Execute INSERT query
      db.query(insertQuery, [columns, ...values], (err, result) => {
        fs.unlinkSync(filePath);

        if (err) {
          console.error("Error inserting data into database:", err);
          return res.status(500).json({ error: "Failed to insert data into database" });
        }

        res.status(200).json({
          message: `${result.rowCount} records inserted successfully`,
        });
      });
    });
  } catch (err) {
    console.error("Error processing Excel file:", err);
    fs.unlinkSync(filePath);
    return res.status(500).json({ error: "Failed to process Excel file" });
  }
});

// Route to execute any SQL query provided by the user
router.get("/execute-query", (req, res) => {
  const sqlQuery = req.query.sql;
  if (!sqlQuery) {
    return res.status(400).send("SQL query is required");
  }
  db.query(sqlQuery, (err, results) => {
    if (err) {
      console.error("Error executing query:", err);
      return res.status(500).send("Error executing query");
    }
    res.json(results);
  });
});

// Route to check if the output matches the expected output for a challenge
router.post("/check-output/:challengeId", async (req, res) => {
  try {
    const challengeId = req.params.challengeId;
    const sqlQuery = req.body.sqlQuery;

    if (!sqlQuery) {
      return res.status(400).send("SQL query is required");
    }

    const challenge = await Challenge.findOne({ _id: challengeId });
    if (!challenge) {
      return res.status(404).send("Challenge not found");
    }

    const expectedOutputData = challenge.outputData;

    db.query(sqlQuery, (err, results) => {
      if (err) {
        console.error("Error executing query:", err);
        return res.status(500).send("Error executing query");
      }

      const isEqual =
        JSON.stringify(results) === JSON.stringify(expectedOutputData);
      res.json({ isEqual, results });
    });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).send("An error occurred");
  }
});

module.exports = router;
