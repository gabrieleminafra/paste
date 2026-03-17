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
      className="rounded-lg px-6 py-2.5 text-sm text-white font-medium bg-primary hover:bg-primary-hover hover:shadow-[0_0_20px_rgba(129,140,248,0.3)] disabled:bg-surface-border disabled:text-muted disabled:cursor-not-allowed disabled:hover:bg-surface-border disabled:hover:shadow-none focus:outline-none focus:ring-2 focus:ring-primary/50 max-lg:min-h-[44px] max-md:w-full"
    >
      {label}
    </button>
  )
}
