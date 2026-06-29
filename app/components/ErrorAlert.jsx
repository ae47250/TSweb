export default function ErrorAlert({ errors = [], warnings = [] }) {
  if (!errors.length && !warnings.length) return null;

  return (
    <>
      {errors.length > 0 && (
        <div className="alert alert-error">
          <strong>Needs attention before PDF generation</strong>
          <ul>
            {errors.map((error) => <li key={error}>{error}</li>)}
          </ul>
        </div>
      )}
      {warnings.length > 0 && (
        <div className="alert">
          <strong>Warnings</strong>
          <ul>
            {warnings.map((warning) => <li key={warning}>{warning}</li>)}
          </ul>
        </div>
      )}
    </>
  );
}
