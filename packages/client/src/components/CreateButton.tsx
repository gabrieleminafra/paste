interface CreateButtonProps {
  disabled: boolean
  onClick: () => void
  label?: string
}

export default function CreateButton({ disabled, onClick, label = 'Create' }: CreateButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="rounded-md px-4 py-2 text-white font-medium transition-colors focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none bg-primary hover:bg-primary-hover disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed disabled:hover:bg-gray-300"
    >
      {label}
    </button>
  )
}
