import { useEffect, useRef } from 'react'
import * as THREE from 'three'

export default function ThreeBackground() {
  const containerRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const animationIdRef = useRef<number | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

    const width = window.innerWidth
    const height = window.innerHeight

    // Scene - transparent background
    const scene = new THREE.Scene()
    sceneRef.current = scene

    // Camera
    const camera = new THREE.OrthographicCamera(
      width / -100,
      width / 100,
      height / 100,
      height / -100,
      1,
      1000
    )
    camera.position.z = 100

    // Renderer - transparent
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
    })
    renderer.setSize(width, height)
    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.setClearColor(0x000000, 0) // Transparent
    containerRef.current.appendChild(renderer.domElement)
    rendererRef.current = renderer

    // Create subtle grid
    const gridSize = 200
    const gridDivisions = 50
    const gridColor = new THREE.Color(0x999999) // Light gray

    // Main grid - very subtle
    const gridHelper = new THREE.GridHelper(
      gridSize,
      gridDivisions,
      gridColor,
      gridColor
    )
    ;(gridHelper.material as THREE.Material).opacity = 0.08
    ;(gridHelper.material as THREE.Material).transparent = true
    scene.add(gridHelper)

    // Handle resize
    const handleResize = () => {
      const newWidth = window.innerWidth
      const newHeight = window.innerHeight

      camera.left = newWidth / -100
      camera.right = newWidth / 100
      camera.top = newHeight / 100
      camera.bottom = newHeight / -100
      camera.updateProjectionMatrix()

      renderer.setSize(newWidth, newHeight)
    }

    window.addEventListener('resize', handleResize)

    // Animation loop
    const animate = () => {
      animationIdRef.current = requestAnimationFrame(animate)
      
      // Subtle rotation
      gridHelper.rotation.z += 0.0001
      
      renderer.render(scene, camera)
    }
    animate()

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize)
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current)
      }
      if (rendererRef.current && containerRef.current) {
        containerRef.current.removeChild(rendererRef.current.domElement)
        rendererRef.current.dispose()
      }
    }
  }, [])

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 -z-10 pointer-events-none"
      id="threeBackground"
    />
  )
}

