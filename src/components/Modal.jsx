export default function Modal({ title, children, actions }) {
  return (
    <div className="modal-backdrop">
      <div className="modal" role="dialog">
        <h2>{title}</h2>
        {children}
        {actions && <div className="modal-actions">{actions}</div>}
      </div>
    </div>
  );
}
