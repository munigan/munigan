import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider, useAccount } from "./AuthProvider";

const { signOut } = vi.hoisted(() => ({ signOut: vi.fn() }));
vi.mock("./client", () => ({
  authClient: { signOut, useSession: () => ({ data: null, isPending: false }) },
}));

function Probe() {
  const auth = useAccount();
  return (
    <div>
      <span>{auth.status}</span>
      <span>{auth.account?.name}</span>
      <button onClick={() => void auth.refresh()}>Retry</button>
      <button onClick={() => void auth.signOut()}>Sign out</button>
    </div>
  );
}

describe("AuthProvider", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    signOut.mockReset();
  });

  it("shows unavailable after a 503 and can retry", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(
        Response.json({
          account: null,
          savingEnabled: false,
          enrollmentEnabled: false,
        }),
      );
    render(<AuthProvider><Probe /></AuthProvider>);
    expect(await screen.findByText("unavailable")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("anonymous")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenLastCalledWith("/api/account/session", expect.objectContaining({ cache: "no-store" }));
  });

  it("clears private children after sign-out succeeds and preserves drafts", async () => {
    localStorage.setItem("munigan.top-gear.draft", "kept");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({
        account: { id: "a1", name: "Munigan", image: null },
        savingEnabled: true,
        enrollmentEnabled: false,
      }),
    );
    signOut.mockResolvedValue({ data: null, error: null });
    render(<AuthProvider><Probe /></AuthProvider>);
    expect(await screen.findByText("Munigan")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Sign out" }));
    await waitFor(() => expect(screen.queryByText("Munigan")).not.toBeInTheDocument());
    expect(screen.getByText("anonymous")).toBeInTheDocument();
    expect(localStorage.getItem("munigan.top-gear.draft")).toBe("kept");
  });

  it("ignores an older session response after a newer refresh", async () => {
    let resolveOld!: (response: Response) => void;
    const oldResponse = new Promise<Response>((resolve) => { resolveOld = resolve; });
    vi.spyOn(globalThis, "fetch")
      .mockReturnValueOnce(oldResponse)
      .mockResolvedValueOnce(Response.json({ account: null, savingEnabled: true, enrollmentEnabled: true }));
    render(<AuthProvider><Probe /></AuthProvider>);
    await act(async () => { await userEvent.click(screen.getByRole("button", { name: "Retry" })); });
    expect(await screen.findByText("anonymous")).toBeInTheDocument();
    await act(async () => resolveOld(Response.json({ account: { id: "old", name: "Old", image: null }, savingEnabled: true, enrollmentEnabled: true })));
    expect(screen.queryByText("Old")).not.toBeInTheDocument();
  });
});
