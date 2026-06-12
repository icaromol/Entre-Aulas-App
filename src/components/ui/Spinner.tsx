interface SpinnerProps {
  size?: number
}

export function Spinner({ size = 20 }: SpinnerProps) {
  return (
    <div
      style={{ width: size, height: size }}
      className="rounded-full border-2 border-[#ff4c3e] border-t-[#0993ae] animate-spin"
    />
  )
}
