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
        const data = await getUserHistory();
        setHistory(Array.isArray(data) ? data : []);
      } catch {
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
          {history.map((item, i) => (
            <li key={i} className="historyItem">
              <span className="label">Meeting Code:</span>{" "}
              {item.meetingCode || item.roomId || item.code || "Unknown"}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
