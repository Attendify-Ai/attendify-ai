export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: "admin" | "teacher" | "house_manager";
  assigned_house_id?: number | null;
  assigned_house_name?: string | null;
  assigned_class?: string | null;
}

export function getStoredUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("user");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function storeAuth(token: string, user: AuthUser) {
  localStorage.setItem("token", token);
  localStorage.setItem("user", JSON.stringify(user));
}

export function clearAuth() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
}

export function isAdmin(): boolean {
  return getStoredUser()?.role === "admin";
}

export function isHouseManager(): boolean {
  return getStoredUser()?.role === "house_manager";
}

export function dashboardHome(role?: string | null): string {
  if (role === "teacher") return "/teacher-dashboard";
  if (role === "house_manager") return "/house-dashboard";
  return "/dashboard";
}

export function roleLabel(user: AuthUser): string {
  if (user.role === "admin") return "Admin";
  if (user.role === "teacher") return user.assigned_class ? `Class Teacher | ${user.assigned_class}` : "Class Teacher";
  if (user.role === "house_manager") return user.assigned_house_name ? `House Manager | ${user.assigned_house_name}` : "House Manager";
  return user.role;
}
