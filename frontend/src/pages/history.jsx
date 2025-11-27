import React, { useContext, useEffect, useState } from "react";
import { AuthContext } from "../contexts/AuthContext";
import "../styles/history.css";

export default function History() {
  const {
    getUserHistory,
    deleteHistoryItem,
    bulkDeleteHistory,
    user,
  } = useContext(AuthContext);

  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState([]);

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

  const toggleSelect = (id) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    if (selected.length === history.length) {
      setSelected([]);
    } else {
      setSelected(history.map((h) => h._id));
    }
  };

  const handleDeleteOne = async (id) => {
    const ok = window.confirm("Delete this history entry?");
    if (!ok) return;
    const res = await deleteHistoryItem(id);
    if (res.ok) {
      setHistory((prev) => prev.filter((h) => h._id !== id));
      setSelected((prev) => prev.filter((x) => x !== id));
    }
  };

  const handleDeleteSelected = async () => {
    if (selected.length === 0) return;
    const ok = window.confirm(`Delete ${selected.length} selected entries?`);
    if (!ok) return;
    const res = await bulkDeleteHistory(selected);
    if (res.ok) {
      setHistory((prev) => prev.filter((h) => !selected.includes(h._id)));
      setSelected([]);
    }
  };

  const formatDateTime = (iso) => {
    if (!iso) return "—";
    const d = new Date(iso);
    return d.toLocaleString();
  };

  const formatDuration = (item) => {
    if (item.durationSeconds != null) {
      const mins = Math.round(item.durationSeconds / 60);
      if (mins <= 1) return `${item.durationSeconds}s`;
      return `${mins} min`;
    }
    if (item.createdAt && item.updatedAt) {
      const diffMs = new Date(item.updatedAt) - new Date(item.createdAt);
      const mins = Math.round(diffMs / 60000);
      if (mins <= 1) return "< 1 min";
      return `${mins} min`;
    }
    return "—";
  };

  return (
    <div className="historyPage">
      <h2 className="historyTitle">Meeting History</h2>

      {loading ? (
        <p className="loadingText">Loading...</p>
      ) : history.length === 0 ? (
        <p className="emptyHistory">No previous meetings found.</p>
      ) : (
        <>
          <div className="historyActions">
            <button
              className="historyBtn"
              onClick={handleDeleteSelected}
              disabled={selected.length === 0}
            >
              Delete Selected ({selected.length})
            </button>
          </div>

          <table className="historyTable">
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    checked={selected.length === history.length}
                    onChange={selectAll}
                  />
                </th>
                <th>Meeting Code</th>
                <th>Host</th>
                <th>Participants</th>
                <th>Started</th>
                <th>Ended</th>
                <th>Duration</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {history.map((item) => (
                <tr key={item._id || item.id || item.roomId}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selected.includes(item._id)}
                      onChange={() => toggleSelect(item._id)}
                    />
                  </td>
                  <td>{item.roomId || item.meetingCode || item.code || "Unknown"}</td>
                  <td>{item.hostName || user?.name || "—"}</td>
                  <td>
                    {Array.isArray(item.participants) &&
                    item.participants.length > 0
                      ? item.participants.join(", ")
                      : "—"}
                  </td>
                  <td>{formatDateTime(item.startedAt || item.createdAt)}</td>
                  <td>{formatDateTime(item.endedAt || item.updatedAt)}</td>
                  <td>{formatDuration(item)}</td>
                  <td>
                    <button
                      className="historyDeleteBtn"
                      onClick={() => handleDeleteOne(item._id)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
