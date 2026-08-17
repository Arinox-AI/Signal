import { ImageResponse } from "next/og";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 16,
        background: "#0b0e14",
        border: "2px solid #26354f",
      }}
    >
      <div
        style={{
          width: 16,
          height: 16,
          borderRadius: 999,
          background: "#78a9ff",
          boxShadow: "0 0 20px #78a9ff",
        }}
      />
    </div>,
    size,
  );
}
