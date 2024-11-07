import { useEffect, useState } from "react";
import { assignTask, getAllTasks } from "./taskService";
import "bootstrap/dist/css/bootstrap.min.css";

const AssignTask = () => {
    const [task, setTask] = useState([]);
    const [selected, setSelectedTask] = useState([]);

    useEffect(() => {
        const fetchTasks = async () => {
            const tasks = await getAllTasks();
            if (tasks) setTask(tasks);
        };

        fetchTasks();
    }, []);

    const handleSelectTask = (value) => {
        // Toggle selection of the task
        setSelectedTask((prev) =>
            prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value]
        );
    };

    const handleSetTasks = () => {
        console.log("Selected Tasks:", selected);
        assignTask(selected);
    };

    return (
        <div className="container mt-4">
            <h2 className="text-center mb-4">Task List</h2>
            {task.length > 0 ? (
                <>
                    <div className="row p-1 gap-1 d-flex justify-content-center" >
                        {task.map((t, index) => (
                            <div
                                key={t.id}
                                className={`col-md-4 mb-3 ${selected.includes(t) ? "bg-success text-white" : "bg-dark text-light"}`}
                                onClick={() => handleSelectTask(t)}
                                style={{ cursor: "pointer", borderRadius: "10px" }}
                            >
                                <div className="card p-3 h-100 w-100">
                                    <h5 className="card-title">Day {index + 1}</h5>
                                    <p className="card-text">{t.title}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="text-center">
                        <button className="btn btn-primary px-5" onClick={handleSetTasks}>
                            Set Tasks
                        </button>
                    </div>
                </>
            ) : (
                <p className="text-center">No tasks available</p>
            )}
        </div>
    );
};

export default AssignTask;
