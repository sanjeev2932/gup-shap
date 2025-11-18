import React, { useContext, useEffect, useState } from "react";
import { AuthContext } from "../contexts/AuthContext";
import "../index.css";

export default function History() {
  const { getUserHistory } = useContext(AuthContext);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const h = await getUserHistory(); // your context should return array of meeting codes
        setHistory(h || []);
      } catch (e) {
        console.warn(e);
      }
    })();
  }, [getUserHistory]);

  return (
    <div className="historyPage">
      <h2>Your History</h2>
      {history.length === 0 ? <p>No history yet</p> : (
        <ul>
          {history.map((h, i) => <li key={i}>{h.meetingCode || h}</li>)}
        </ul>
      )}
    </div>
  );
}
