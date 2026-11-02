export default function LoadingState({ label = "Loading..." }) {
  return <p className="loading-state" role="status">{label}</p>;
}
