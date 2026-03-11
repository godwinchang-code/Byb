import { useEffect } from "react";
import { useSessionStore, type RecentSession } from "@/stores/session-store";
import { useComparisonStore } from "@/stores/comparison-store";
import "./RecentSessions.css";

function RecentSessions() {
  const { recentSessions, loaded, load, removeSession } = useSessionStore();
  const { setLeftPath, setRightPath, setView } = useComparisonStore();

  useEffect(() => {
    if (!loaded) load();
  }, [loaded, load]);

  const handleOpen = (session: RecentSession) => {
    setLeftPath(session.left);
    setRightPath(session.right);
    setView(session.type === "directory" ? "dir-compare" : "text-compare");
  };

  if (!loaded || recentSessions.length === 0) return null;

  return (
    <div className="recent-sessions">
      <h3 className="recent-title">Recent Comparisons</h3>
      <ul className="recent-list">
        {recentSessions.map((session, i) => (
          <li key={`${session.left}-${session.right}-${session.timestamp}`} className="recent-item">
            <button className="recent-open" onClick={() => handleOpen(session)}>
              <span className="recent-type">
                {session.type === "directory" ? "DIR" : "FILE"}
              </span>
              <span className="recent-paths">
                <span className="recent-path" title={session.left}>
                  {truncatePath(session.left)}
                </span>
                <span className="recent-separator">↔</span>
                <span className="recent-path" title={session.right}>
                  {truncatePath(session.right)}
                </span>
              </span>
              <span className="recent-time">{formatTime(session.timestamp)}</span>
            </button>
            <button
              className="recent-remove"
              onClick={(e) => {
                e.stopPropagation();
                removeSession(i);
              }}
              title="Remove"
            >
              ×
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function truncatePath(path: string, maxLen = 30): string {
  if (path.length <= maxLen) return path;
  return "..." + path.slice(-maxLen + 3);
}

function formatTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default RecentSessions;
