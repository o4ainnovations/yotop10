interface SubmitButtonProps {
  loading?: boolean;
  disabled?: boolean;
  label?: string;
  loadingLabel?: string;
}

export default function SubmitButton({
  loading = false,
  disabled = false,
  label = 'Submit',
  loadingLabel = 'Submitting...',
}: SubmitButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <button
      type="submit"
      disabled={isDisabled}
      style={{
        width: '100%',
        padding: '15px',
        fontSize: '18px',
        fontWeight: 'bold',
        backgroundColor: isDisabled ? '#ccc' : '#0066cc',
        color: 'white',
        border: 'none',
        borderRadius: '5px',
        cursor: isDisabled ? 'not-allowed' : 'pointer',
      }}
    >
      {loading ? loadingLabel : label}
    </button>
  );
}
