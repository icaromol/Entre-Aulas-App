interface SpinnerProps {
  size?: number
}

export function Spinner({ size = 20 }: SpinnerProps) {
  return (
    <div
      style={{ width: size, height: size }}
      className="rounded-full border-2 border-[#D6E4F0] border-t-[#4A90C4] animate-spin"
    />
  )
}
