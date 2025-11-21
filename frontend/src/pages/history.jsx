// frontend/src/pages/history.jsx
import React, { useContext, useEffect, useState } from "react";
import { AuthContext } from "../contexts/AuthContext";
import "../styles/history.css";

export default function History() {
  const { getUserHistory } = useContext(AuthContext);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadHistory = async () => {
      try {
        const data = await getUserHistory();  // must return an array
        setHistory(data || []);
      } catch (err) {
        console.error("Failed to fetch history:", err);
        setHistory([]);
      }
      setLoading(false);
    };

    loadHistory();
  }, [getUserHistory]);

  return (
    <div className="historyPage">
      <h2 className="historyTitle">Meeting History</h2>

      {loading ? (
        <p className="loadingText">Loading...</p>
      ) : history.length === 0 ? (
        <p className="emptyHistory">No previous meetings found.</p>
      ) : (
        <ul className="historyList">
          {history.map((item, index) => (
            <li key={index} className="historyItem">
              <span className="label">Meeting Code:</span>{" "}
              {item.meetingCode || item.roomId || item.code}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
