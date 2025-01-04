import axios from "axios";

const APIURL = "https://learnsql-l80r.onrender.com/";

export const viewContest = async () => {
  try {
    const token = localStorage.getItem("token");
    console.log(token);
    const response = await axios.post(`${APIURL}api/getContest`,{
      type:'contest'
    }, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    console.log(response.data.contest);
    return response.data.contest;
  } catch (err) {
    console.log(err);
  }
};
