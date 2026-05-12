import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import Home from "./page";

// Mock next/font/google
vi.mock("next/font/google", () => ({
  Outfit: () => ({
    className: "mocked-outfit",
  }),
}));

// Mock next/link
vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

describe("Home Page", () => {
  it("renders the main sections", () => {
    render(<Home />);

    expect(screen.getByText("Deine Werkzeuge")).toBeInTheDocument();
    expect(screen.getByText("Ausbau-Guides & Wissen")).toBeInTheDocument();
  });
});
