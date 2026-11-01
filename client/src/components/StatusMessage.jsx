export default function StatusMessage({ children, kind = "error" }) {
  if (!children) return null;
  return <p className={`status-message status-${kind}`} role={kind === "error" ? "alert" : "status"}>{children}</p>;
}
