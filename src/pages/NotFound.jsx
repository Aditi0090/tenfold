import { Link } from 'react-router-dom';
export default function NotFound() {
  return (
    <div className="wrap section">
      <h1>That page doesn&rsquo;t exist</h1>
      <p className="lede">The link may be old, or the address mistyped.</p>
      <Link className="btn" to="/">Go to the homepage</Link>
    </div>
  );
}
