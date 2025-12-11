"use client"

import { useMemo, useState } from "react"
import { SVD } from "svd-js"
import { Canvas } from "@react-three/fiber"
import { Grid, Html, Line, OrbitControls } from "@react-three/drei"
import { Euler, Quaternion, Vector3 } from "three"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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

export default function Home() {
  const [matrixValues, setMatrixValues] = useState<MatrixString>(defaultMatrix)
  const [vectorValues, setVectorValues] = useState<string[]>(defaultVector)

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
              <PlotContainer>
                <SharedScene>
                  <VectorArrow vector={numericVector} color="#6366f1" label="x" />
                </SharedScene>
              </PlotContainer>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>SVD Transform Steps</CardTitle>
              <CardDescription>Follow each operation applied to the vector.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <PlotContainer>
                <SharedScene>
                  <VectorArrow vector={vtVector} color="#ec4899" label="Vᵀ · x" />
                  <VectorArrow vector={sigmaVector} color="#f97316" label="Σ · Vᵀ · x" />
                  <VectorArrow vector={uVector} color="#10b981" label="U · Σ · Vᵀ · x" />
                </SharedScene>
              </PlotContainer>
              <p className="text-sm text-muted-foreground">
                All arrows originate at the origin. Pink rotates the vector with Vᵀ, orange scales it
                via Σ, and green applies the final U rotation—matching the Ax result.
              </p>
            </CardContent>
          </Card>
        </section>
      </main>
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

const PlotContainer = ({ children }: { children: React.ReactNode }) => (
  <div className="h-80 overflow-hidden rounded-xl border bg-muted/40">
    <Canvas camera={{ position: [4, 4, 4], fov: 45 }}>{children}</Canvas>
  </div>
)

const SharedScene = ({ children }: { children: React.ReactNode }) => (
  <>
    <ambientLight intensity={0.8} />
    <directionalLight position={[6, 6, 6]} intensity={0.6} />
    <Grid
      args={[10, 10]}
      sectionColor="#cbd5f5"
      cellColor="#e5e7eb"
      position={[0, -0.001, 0]}
      infiniteGrid
      fadeDistance={20}
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
  label: string
}

const VectorArrow = ({ vector, color, label }: VectorArrowProps) => {
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

  const labelPosition = arrowData.tip.map((value) => value * 1.05) as [number, number, number]

  return (
    <group>
      <Line
        points={[
          [0, 0, 0],
          arrowData.tip,
        ]}
        color={color}
        lineWidth={2}
      />
      <mesh position={arrowData.tip} rotation={arrowData.rotation}>
        <coneGeometry args={[0.07, 0.22, 24]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <Html position={labelPosition} className="rounded-md bg-background/90 px-2 py-1 text-xs font-semibold text-foreground shadow">
        {label}
      </Html>
    </group>
  )
}
