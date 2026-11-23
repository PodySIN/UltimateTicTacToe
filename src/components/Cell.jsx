export default function Cell({ value, onClick, disabled, isLast }) {
  const cls = ['cell', value === 'X' && 'x', value === 'O' && 'o', value && 'filled', isLast && 'last']
    .filter(Boolean)
    .join(' ');
  return (
    <button type="button" className={cls} onClick={onClick} disabled={disabled || !!value}>
      {value || ''}
    </button>
  );
}
