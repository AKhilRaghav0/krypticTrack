import { useEffect, useRef } from 'react'

interface Layer {
  size: number
  label: string
}

export default function NeuralNetworkViz() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationFrameRef = useRef<number | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const layers: Layer[] = [
      { size: 240, label: 'Input\n(State+Action)' },
      { size: 256, label: 'Hidden 1' },
      { size: 128, label: 'Hidden 2' },
      { size: 64, label: 'Hidden 3' },
      { size: 1, label: 'Output\n(Reward)' },
    ]

    const setupCanvas = () => {
      const container = canvas.parentElement
      if (!container) return
      const rect = container.getBoundingClientRect()
      canvas.width = rect.width || container.clientWidth || 800
      canvas.height = 400
    }

    setupCanvas()
    const resizeHandler = () => setupCanvas()
    window.addEventListener('resize', resizeHandler)

    const neurons: Array<{ x: number; y: number; layer: number }> = []
    const connections: Array<{ from: number; to: number }> = []
    const activationValues: number[] = []

    const initializeNetwork = () => {
      const width = canvas.width
      const height = canvas.height
      const layerSpacing = width / (layers.length + 1)

      neurons.length = 0
      connections.length = 0
      activationValues.length = 0

      layers.forEach((layer, layerIndex) => {
        const x = layerSpacing * (layerIndex + 1)
        const neuronSpacing = height / (layer.size + 1)

        for (let i = 0; i < layer.size; i++) {
          const y = neuronSpacing * (i + 1)
          neurons.push({ x, y, layer: layerIndex })
          activationValues.push(Math.random())
        }
      })

      // Create connections
      for (let i = 0; i < neurons.length; i++) {
        const currentLayer = neurons[i].layer
        if (currentLayer < layers.length - 1) {
          for (let j = 0; j < neurons.length; j++) {
            if (neurons[j].layer === currentLayer + 1) {
              connections.push({ from: i, to: j })
            }
          }
        }
      }
    }

    initializeNetwork()

    const animate = () => {
      if (!ctx) return

      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // Update activation values (simulate activity)
      for (let i = 0; i < activationValues.length; i++) {
        activationValues[i] = Math.max(
          0,
          Math.min(1, activationValues[i] + (Math.random() - 0.5) * 0.1)
        )
      }

      // Draw connections
      ctx.strokeStyle = 'rgba(163, 29, 29, 0.2)'
      ctx.lineWidth = 1
      connections.forEach((conn) => {
        const from = neurons[conn.from]
        const to = neurons[conn.to]
        const opacity = (activationValues[conn.from] + activationValues[conn.to]) / 2
        ctx.strokeStyle = `rgba(163, 29, 29, ${opacity * 0.3})`
        ctx.beginPath()
        ctx.moveTo(from.x, from.y)
        ctx.lineTo(to.x, to.y)
        ctx.stroke()
      })

      // Draw neurons
      neurons.forEach((neuron, idx) => {
        const activation = activationValues[idx]
        const radius = 4 + activation * 2

        // Neuron circle
        ctx.fillStyle = `rgba(163, 29, 29, ${0.3 + activation * 0.7})`
        ctx.beginPath()
        ctx.arc(neuron.x, neuron.y, radius, 0, Math.PI * 2)
        ctx.fill()

        // Neuron border
        ctx.strokeStyle = `rgba(163, 29, 29, ${0.5 + activation * 0.5})`
        ctx.lineWidth = 1.5
        ctx.stroke()
      })

      // Draw layer labels
      ctx.fillStyle = '#6c757d'
      ctx.font = '12px Inter, sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      layers.forEach((layer, layerIndex) => {
        const x = (canvas.width / (layers.length + 1)) * (layerIndex + 1)
        const labelLines = layer.label.split('\n')
        labelLines.forEach((line, lineIndex) => {
          ctx.fillText(line, x, canvas.height - 30 + lineIndex * 14)
        })
      })

      animationFrameRef.current = requestAnimationFrame(animate)
    }

    animate()

    return () => {
      window.removeEventListener('resize', resizeHandler)
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [])

  return (
    <div className="w-full bg-white rounded-xl border border-gray-200 p-6">
      <h3 className="text-lg font-bold text-gray-900 mb-4">Neural Network Architecture</h3>
      <canvas
        ref={canvasRef}
        className="w-full"
        style={{ height: '400px' }}
      />
    </div>
  )
}

