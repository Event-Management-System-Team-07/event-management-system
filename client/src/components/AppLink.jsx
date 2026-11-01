import { navigate } from "../lib/navigation";

export default function AppLink({ href, onClick, children, ...props }) {
  function handleClick(event) {
    onClick?.(event);
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) return;

    event.preventDefault();
    navigate(href);
  }

  return <a href={href} onClick={handleClick} {...props}>{children}</a>;
}
