/** Row of number chips; numbers in `hits` are highlighted. */
export default function Chips({ numbers = [], hits = [], variant = '', small = false }) {
  const hitSet = new Set(hits);
  return (
    <div className="chips">
      {numbers.map((n, i) => (
        <span key={`${n}-${i}`} className={`chip ${small ? 'chip-sm' : ''} ${variant} ${hitSet.has(n) ? 'hit' : ''}`}>{n}</span>
      ))}
    </div>
  );
}
