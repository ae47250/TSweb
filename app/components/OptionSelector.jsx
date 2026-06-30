"use client";

export default function OptionSelector({ options = [], selectedOption, onSelect }) {
  return (
    <section>
      <h3>Choose one option</h3>
      {options.map((option) => {
        const selected = selectedOption === option.label;
        return (
          <button
            key={option.label}
            className={`option-button ${selected ? "selected" : ""}`}
            onClick={() => onSelect(selected ? "" : option.label)}
            type="button"
          >
            <strong>{option.label}: {option.title}</strong>
            <br />
            <span>{option.price?.display}</span>
            <br />
            <span className="text-muted">{option.description}</span>
            {selected && <div>Selected</div>}
          </button>
        );
      })}
    </section>
  );
}
