export interface IOC {
    type: string
    severity: string
    source: string
    assetCriticality?: number
}

export interface ThreatAnalysis {
    riskScore: number
    threatLevel: string
    recommendation: string
}

export function analyzeThreat(ioc: IOC): ThreatAnalysis {

    let score = 0

    if (ioc.type === "malware") score += 30
    if (ioc.severity === "high") score += 30
    if (ioc.source === "malwarebazaar") score += 20

    if (ioc.assetCriticality && ioc.assetCriticality >= 4) {
        score += 20
    }

    let level = "LOW"

    if (score > 70) level = "HIGH"
    else if (score > 40) level = "MEDIUM"

    return {
        riskScore: score,
        threatLevel: level,
        recommendation: "Investigate affected assets and block IOC"
    }
}
