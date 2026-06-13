export function mapSeverityToBadgeVariant(severity: string): 'default' | 'critical' | 'high' | 'medium' | 'low' | 'success' | 'warning' | 'danger' {
  return severity === 'info' ? 'default' : (severity as any);
}
