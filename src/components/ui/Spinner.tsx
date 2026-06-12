interface SpinnerProps {
  size?: number
}

export function Spinner({ size = 20 }: SpinnerProps) {
  return (
    <div
      style={{ width: size, height: size }}
      className="rounded-full border-2 border-[#FF5A53] border-t-[#0099FF] animate-spin"
    />
  )
}
