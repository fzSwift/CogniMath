/** e.g. "Ama Mensah · Primary 1" or "Ama Mensah · Primary 1, JSS 2" when enrolled in multiple classes. */
export function formatStudentWithClasses(fullName: string, enrolledClassNames: string | null | undefined): string {
  const t = (enrolledClassNames ?? "").trim();
  return t ? `${fullName} · ${t}` : fullName;
}
