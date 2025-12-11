"use client"

import { type ReactNode, useEffect, useMemo, useState } from "react"
import { createPortal } from "react-dom"
import { SVD } from "svd-js"
import { Canvas } from "@react-three/fiber"
import { Grid, Line, OrbitControls } from "@react-three/drei"
import { Euler, Quaternion, Vector3 } from "three"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"

type MatrixString = string[][]
type MatrixNumber = number[][]

const defaultMatrix: MatrixString = [
  ["1", "0", "0"],
  ["0", "1", "0"],
  ["0", "0", "1"],
]

const defaultVector = ["1", "0", "0"]

const numberFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 4,
  minimumFractionDigits: 0,
})

const parseCellValue = (value: string) => {
  const parsed = parseFloat(value)
  return Number.isFinite(parsed) ? parsed : 0
}

const toNumericMatrix = (values: MatrixString): MatrixNumber =>
  values.map((row) => row.map(parseCellValue))

const multiplyMatrixVector = (matrix: MatrixNumber, vector: number[]) =>
  matrix.map((row) => row.reduce((sum, value, index) => sum + value * (vector[index] ?? 0), 0))

const transpose = (matrix: MatrixNumber) =>
  matrix[0]
    ? matrix[0].map((_, columnIndex) => matrix.map((row) => row[columnIndex] ?? 0))
    : []

const buildSigmaMatrix = (diagonal: number[], rows: number, columns: number) =>
  Array.from({ length: rows }, (_, row) =>
    Array.from({ length: columns }, (_, column) => (row === column ? diagonal[row] ?? 0 : 0)),
  )

const formatNumber = (value: number) => numberFormatter.format(parseFloat(value.toFixed(4)))

type PlotKey = "original" | "steps"

export default function Home() {
  const [matrixValues, setMatrixValues] = useState<MatrixString>(defaultMatrix)
  const [vectorValues, setVectorValues] = useState<string[]>(defaultVector)
  const [expandedPlot, setExpandedPlot] = useState<PlotKey | null>(null)

  const numericMatrix = useMemo(() => toNumericMatrix(matrixValues), [matrixValues])
  const numericVector = useMemo(() => vectorValues.map(parseCellValue), [vectorValues])

  const productVector = useMemo(
    () => multiplyMatrixVector(numericMatrix, numericVector),
    [numericMatrix, numericVector],
  )

  const svdResult = useMemo(() => {
    try {
      const { u, v, q } = SVD(numericMatrix)
      const sigma = buildSigmaMatrix(q, numericMatrix.length, numericMatrix[0]?.length ?? 0)
      const vt = transpose(v)
      return { u, sigma, vt }
    } catch {
      return null
    }
  }, [numericMatrix])

  const vtVector = useMemo(() => {
    if (!svdResult) return [0, 0, 0]
    return multiplyMatrixVector(svdResult.vt, numericVector)
  }, [svdResult, numericVector])

  const sigmaVector = useMemo(() => {
    if (!svdResult) return [0, 0, 0]
    return multiplyMatrixVector(svdResult.sigma, vtVector)
  }, [svdResult, vtVector])

  const uVector = useMemo(() => {
    if (!svdResult) return [0, 0, 0]
    return multiplyMatrixVector(svdResult.u, sigmaVector)
  }, [svdResult, sigmaVector])

  const originalScene = (
    <SharedScene>
      <VectorArrow vector={numericVector} color="#6366f1" />
    </SharedScene>
  )

  const stepsScene = (
    <SharedScene>
      <VectorArrow vector={numericVector} color="#6366f1" />
      <VectorArrow vector={vtVector} color="#ec4899" />
      <VectorArrow vector={sigmaVector} color="#f97316" />
      <VectorArrow vector={uVector} color="#10b981" />
    </SharedScene>
  )

  const plotContent: Record<PlotKey, { title: string; node: ReactNode }> = {
    original: { title: "Original Vector", node: originalScene },
    steps: { title: "SVD Transform Steps", node: stepsScene },
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted py-12">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 md:px-8">
        <header className="flex flex-col gap-4 text-center">
          <p className="text-sm font-semibold tracking-[0.3em] text-muted-foreground">RAHUL BIR - EECS182</p>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">SVD Visualizer</h1>
          <p className="text-base text-muted-foreground">
            Adjust a 3×3 transformation matrix and a vector. See the raw matrix product, the SVD
            factors (U, Σ, Vᵀ), and how each step transforms the vector in 3D space—all computed
            directly in the browser.
          </p>
        </header>

        <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <Card className="border-dashed">
            <CardHeader>
              <CardTitle>Matrix & Vector</CardTitle>
              <CardDescription>Enter values below to drive the visualization.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-6">
              <div className="flex flex-col gap-3">
                <Label htmlFor="matrix-input">Transformation Matrix (3×3)</Label>
                <div className="grid grid-cols-3 gap-3" id="matrix-input">
                  {matrixValues.map((row, rowIndex) =>
                    row.map((value, columnIndex) => (
                      <Input
                        key={`${rowIndex}-${columnIndex}`}
                        inputMode="decimal"
                        value={value}
                        onChange={(event) => {
                          const newValue = event.target.value
                          setMatrixValues((previous) =>
                            previous.map((existingRow, r) =>
                              existingRow.map((cell, c) =>
                                r === rowIndex && c === columnIndex ? newValue : cell,
                              ),
                            ),
                          )
                        }}
                        aria-label={`Matrix cell [${rowIndex + 1}, ${columnIndex + 1}]`}
                      />
                    )),
                  )}
                </div>
              </div>
              <div className="flex flex-col gap-3">
                <Label htmlFor="vector-input">Input Vector</Label>
                <div className="grid grid-cols-3 gap-3" id="vector-input">
                  {vectorValues.map((value, index) => (
                    <Input
                      key={index}
                      inputMode="decimal"
                      value={value}
                      onChange={(event) => {
                        const newValue = event.target.value
                        setVectorValues((previous) =>
                          previous.map((cell, i) => (i === index ? newValue : cell)),
                        )
                      }}
                      aria-label={`Vector component ${index + 1}`}
                    />
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-dashed">
            <CardHeader>
              <CardTitle>Matrix × Vector Output</CardTitle>
              <CardDescription>Direct multiplication result.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <VectorDisplay label="Output Vector" values={productVector} />
              {svdResult && (
                <>
                  <Separator />
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <p>Cross-check</p>
                    <p>
                      ∥U Σ Vᵀ x∥ equals ∥Ax∥ within floating point precision. Track intermediate
                      values below.
                    </p>
                  </div>
                  <VectorDisplay label="Vᵀ · x" values={vtVector} />
                  <VectorDisplay label="Σ · (Vᵀ · x)" values={sigmaVector} />
                  <VectorDisplay label="U · Σ · Vᵀ · x" values={uVector} highlight />
                </>
              )}
            </CardContent>
          </Card>
        </section>

        {svdResult && (
          <Card>
            <CardHeader>
              <CardTitle>Singular Value Decomposition</CardTitle>
              <CardDescription>A = U · Σ · Vᵀ</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6 md:grid-cols-3">
              <MatrixDisplay label="U" matrix={svdResult.u} />
              <MatrixDisplay label="Σ" matrix={svdResult.sigma} />
              <MatrixDisplay label="Vᵀ" matrix={svdResult.vt} />
            </CardContent>
          </Card>
        )}

        <section className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Original Vector</CardTitle>
              <CardDescription>See the starting direction with axes for reference.</CardDescription>
            </CardHeader>
            <CardContent>
              <PlotContainer onExpand={() => setExpandedPlot("original")}>{originalScene}</PlotContainer>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>SVD Transform Steps</CardTitle>
              <CardDescription>Follow each operation applied to the vector.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <PlotContainer onExpand={() => setExpandedPlot("steps")}>{stepsScene}</PlotContainer>
              <Legend
                items={[
                  { color: "#6366f1", label: "x" },
                  { color: "#ec4899", label: "Vᵀ · x" },
                  { color: "#f97316", label: "Σ · Vᵀ · x" },
                  { color: "#10b981", label: "U · Σ · Vᵀ · x" },
                ]}
              />
              <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                <li>Vᵀ rotates x into the basis defined by V, aligning the vector to principal axes.</li>
                <li>Σ scales that rotated vector independently along each dimension.</li>
                <li>U applies the final rotation, landing exactly on the Ax result.</li>
              </ul>
            </CardContent>
          </Card>
        </section>
      </main>
      <FullScreenPlot
        isOpen={Boolean(expandedPlot)}
        title={expandedPlot ? plotContent[expandedPlot].title : ""}
        onClose={() => setExpandedPlot(null)}
      >
        {expandedPlot ? plotContent[expandedPlot].node : null}
      </FullScreenPlot>
    </div>
  )
}

type VectorDisplayProps = {
  label: string
  values: number[]
  highlight?: boolean
}

const VectorDisplay = ({ label, values, highlight }: VectorDisplayProps) => (
  <div className="space-y-1">
    <p className="text-sm font-medium text-muted-foreground">{label}</p>
    <div
      className={`flex items-center gap-2 rounded-lg border bg-card px-3 py-2 font-mono text-sm ${
        highlight ? "border-primary text-primary" : ""
      }`}
    >
      {values.map((value, index) => (
        <span key={index} className="flex-1 text-center">
          {formatNumber(value)}
        </span>
      ))}
    </div>
  </div>
)

type MatrixDisplayProps = {
  label: string
  matrix: MatrixNumber
}

const MatrixDisplay = ({ label, matrix }: MatrixDisplayProps) => (
  <div className="space-y-2">
    <p className="text-sm font-medium text-muted-foreground">{label}</p>
    <div className="overflow-hidden rounded-lg border">
      {matrix.map((row, rowIndex) => (
        <div
          key={`row-${rowIndex}`}
          className="flex divide-x divide-border border-t first:border-t-0"
        >
          {row.map((value, columnIndex) => (
            <div key={`cell-${rowIndex}-${columnIndex}`} className="w-full px-3 py-2 text-center font-mono text-sm">
              {formatNumber(value)}
            </div>
          ))}
        </div>
      ))}
    </div>
  </div>
)

const PlotContainer = ({ children, onExpand }: { children: ReactNode; onExpand: () => void }) => (
  <div className="relative h-80 overflow-hidden rounded-xl border bg-muted/40">
    <Button
      size="sm"
      variant="ghost"
      className="absolute right-4 top-4 z-10 bg-background/70"
      onClick={onExpand}
    >
      Expand
    </Button>
    <Canvas camera={{ position: [4, 4, 4], fov: 45 }}>{children}</Canvas>
  </div>
)

const FullScreenPlot = ({
  isOpen,
  title,
  onClose,
  children,
}: {
  isOpen: boolean
  title: string
  onClose: () => void
  children: ReactNode
}) => {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return
    if (isOpen) {
      const previousOverflow = document.body.style.overflow
      document.body.style.overflow = "hidden"
      return () => {
        document.body.style.overflow = previousOverflow
      }
    }
  }, [isOpen, mounted])

  if (!mounted || !isOpen) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4 py-8">
      <div className="w-full max-w-5xl rounded-2xl border bg-background p-6 shadow-2xl">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
              Expanded view
            </p>
            <h2 className="text-2xl font-semibold">{title}</h2>
          </div>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
        <div className="mt-4 h-[34rem] overflow-hidden rounded-xl border bg-muted/40">
          <Canvas camera={{ position: [4, 4, 4], fov: 45 }}>{children}</Canvas>
        </div>
      </div>
    </div>,
    document.body,
  )
}

const SharedScene = ({ children }: { children: React.ReactNode }) => (
  <>
    <ambientLight intensity={0.8} />
    <directionalLight position={[6, 6, 6]} intensity={0.6} />
    <Grid
      args={[12, 12]}
      sectionColor="#94a3b8"
      cellColor="#cbd5f5"
      sectionThickness={1.4}
      cellThickness={1}
      cellSize={0.75}
      position={[0, -0.001, 0]}
      infiniteGrid
      fadeDistance={35}
      fadeStrength={1}
    />
    <axesHelper args={[2.5]} />
    {children}
    <OrbitControls makeDefault enablePan={false} />
  </>
)

type VectorArrowProps = {
  vector: number[]
  color: string
  thickness?: number
}

const VectorArrow = ({ vector, color, thickness = 4 }: VectorArrowProps) => {
  const arrowData = useMemo(() => {
    const direction = new Vector3(vector[0] ?? 0, vector[1] ?? 0, vector[2] ?? 0)
    if (direction.lengthSq() === 0) {
      return { visible: false, tip: [0, 0, 0] as [number, number, number], rotation: [0, 0, 0] as [
        number,
        number,
        number,
      ] }
    }

    const tip = direction.toArray() as [number, number, number]
    const quaternion = new Quaternion().setFromUnitVectors(
      new Vector3(0, 1, 0),
      direction.clone().normalize(),
    )
    const euler = new Euler().setFromQuaternion(quaternion)

    return {
      visible: true,
      tip,
      rotation: [euler.x, euler.y, euler.z] as [number, number, number],
    }
  }, [vector])

  if (!arrowData.visible) return null

  return (
    <group>
      <Line
        points={[
          [0, 0, 0],
          arrowData.tip,
        ]}
        color={color}
        lineWidth={thickness}
      />
      <mesh position={arrowData.tip} rotation={arrowData.rotation}>
        <coneGeometry args={[0.07, 0.22, 24]} />
        <meshStandardMaterial color={color} />
      </mesh>
    </group>
  )
}

const Legend = ({ items }: { items: { color: string; label: string }[] }) => (
  <div className="flex flex-wrap gap-4">
    {items.map((item) => (
      <div key={item.label} className="flex items-center gap-2 text-sm font-medium">
        <span
          className="h-3 w-6 rounded-full"
          style={{ backgroundColor: item.color }}
          aria-hidden
        />
        {item.label}
      </div>
    ))}
  </div>
)
