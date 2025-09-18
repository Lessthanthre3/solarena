'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

// API Configuration
const HELIUS_API_KEY = process.env.NEXT_PUBLIC_HELIUS_API_KEY
const PUMPPORTAL_API_KEY = process.env.NEXT_PUBLIC_PUMPPORTAL_API_KEY

// Game Configuration
const GAME_CONFIG = {
  ARENA_WIDTH: 1440, // 60% of 2400 (reduced by 40%)
  ARENA_HEIGHT: 960, // 60% of 1600 (reduced by 40%)
  PLAYER_RADIUS: 2, // Microscopic initial size
  BASE_PROJECTILE_SPEED: 12, // Higher initial speed for micro sprites
  MIN_SPEED: 2,
  MAX_VELOCITY: 500, // Maximum velocity for damage calculation (px/s)
  MIN_COLLISION_SPEED: 15, // Collision speed threshold
  BASE_DAMAGE: 8, // Balanced damage
  VELOCITY_DAMAGE_MULTIPLIER: 0.15, // Damage multiplier
  WALL_DAMAGE: false, // Walls never cause damage
  JITS_ENABLED: false, // Disable automatic elimination - only collision damage
  VELOCITY_SCALE_FACTOR: 0.8 // How much velocity reduces as size increases
}

// Generate test wallet for demo
const generateTestWallet = () => {
  const chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
  let wallet = ''
  for (let i = 0; i < 44; i++) {
    wallet += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return wallet
}

// Fetch token holders using Helius API (production-ready)
const fetchTokenHolders = async (contractAddress: string, minThreshold: string) => {
  try {
    if (!HELIUS_API_KEY) {
      console.warn('No Helius API key found, using mock data')
      return generateMockHolders(minThreshold)
    }

    const allHolders: Array<{wallet: string, balance: string}> = []
    let page = 1
    const limit = 1000 // Helius max per request

    while (true) {
      const response = await fetch(`https://api.helius.xyz/v0/token-accounts?api-key=${HELIUS_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'getTokenAccounts',
          id: 'sol-arena-query',
          params: {
            page: page,
            limit: limit,
            mint: contractAddress,
            options: {
              showZeroBalance: false // Filter out empty accounts
            }
          }
        })
      })

      if (!response.ok) {
        throw new Error(`Helius API error: ${response.status}`)
      }

      const data = await response.json()
      
      if (!data.result || !data.result.token_accounts || data.result.token_accounts.length === 0) {
        break
      }

      // Process holder data with 6-decimal precision for pump.fun tokens
      data.result.token_accounts.forEach((account: any) => {
        const balance = account.amount / Math.pow(10, 6) // Pump.fun uses 6 decimals
        if (balance >= parseFloat(minThreshold)) {
          allHolders.push({
            wallet: account.owner,
            balance: balance.toFixed(6)
          })
        }
      })

      // If we got less than the limit, we've reached the end
      if (data.result.token_accounts.length < limit) {
        break
      }

      page++
      
      // Safety limit to prevent infinite loops
      if (page > 100) {
        console.warn('Reached page limit, stopping pagination')
        break
      }
    }

    console.log(`Found ${allHolders.length} eligible holders with minimum ${minThreshold} tokens`)
    return allHolders

  } catch (error) {
    console.error('Error fetching holders from Helius:', error)
    console.log('Falling back to mock data for demo')
    return generateMockHolders(minThreshold)
  }
}

// Generate mock holders for demo/fallback
const generateMockHolders = (minThreshold: string) => {
  const testHolders = []
  const count = Math.floor(Math.random() * 500) + 2000 // 2000-2500 players for better performance
  
  for (let i = 0; i < count; i++) {
    testHolders.push({
      wallet: generateTestWallet(),
      balance: (Math.random() * 10000 + parseFloat(minThreshold)).toFixed(6)
    })
  }
  
  return testHolders
}

// Player class
class Player {
  id: number
  x: number
  y: number
  vx: number
  vy: number
  radius: number
  color: string
  health: number
  maxHealth: number
  isAlive: boolean
  wallet: string
  trail: Array<{x: number, y: number}>
  lastCollisionFrame: number

  constructor(id: number, x: number, y: number, color: string, walletAddress: string) {
    this.id = id
    this.x = x
    this.y = y
    
    // Launch as projectile with high initial speed
    const angle = Math.random() * Math.PI * 2
    this.vx = Math.cos(angle) * GAME_CONFIG.BASE_PROJECTILE_SPEED
    this.vy = Math.sin(angle) * GAME_CONFIG.BASE_PROJECTILE_SPEED
    
    this.radius = GAME_CONFIG.PLAYER_RADIUS
    this.color = color
    this.health = 100
    this.maxHealth = 100
    this.isAlive = true
    this.wallet = walletAddress
    this.trail = []
    this.lastCollisionFrame = 0
  }

  update(totalPlayers: number, alivePlayers: number, frameCount: number) {
    if (!this.isAlive) return

    // Dynamic size scaling based on elimination percentage
    const eliminationPercentage = (totalPlayers - alivePlayers) / totalPlayers
    let sizeMultiplier = 1.0
    
    if (eliminationPercentage >= 0.25 && eliminationPercentage < 0.5) {
      sizeMultiplier = 1.25 // 25% eliminated -> 25% bigger
    } else if (eliminationPercentage >= 0.5 && eliminationPercentage < 0.75) {
      sizeMultiplier = 1.5 // 50% eliminated -> 50% bigger
    } else if (eliminationPercentage >= 0.75 && alivePlayers > 5) {
      sizeMultiplier = 1.75 // 75% eliminated -> 75% bigger
    } else if (alivePlayers <= 5) {
      sizeMultiplier = 2.0 // Last 5 players -> double size
    }
    
    this.radius = GAME_CONFIG.PLAYER_RADIUS * sizeMultiplier

    // Dynamic velocity scaling - faster when small, slower when big
    const velocityMultiplier = Math.pow(GAME_CONFIG.VELOCITY_SCALE_FACTOR, sizeMultiplier - 1)
    
    // Apply velocity scaling to current velocity
    const currentSpeed = Math.sqrt(this.vx * this.vx + this.vy * this.vy)
    const targetSpeed = GAME_CONFIG.BASE_PROJECTILE_SPEED * velocityMultiplier
    
    if (currentSpeed > 0) {
      const speedRatio = targetSpeed / currentSpeed
      this.vx *= speedRatio * 0.98 // Gradual adjustment
      this.vy *= speedRatio * 0.98
    }

    // Add to trail (reduced for memory efficiency)
    if (frameCount % 2 === 0) { // Only add trail every other frame
      this.trail.push({ x: this.x, y: this.y })
      if (this.trail.length > 6) this.trail.shift() // Shorter trails
    }

    // Update position
    this.x += this.vx
    this.y += this.vy

    // Wall collisions (no damage, just bounce)
    if (this.x - this.radius <= 0 || this.x + this.radius >= GAME_CONFIG.ARENA_WIDTH) {
      this.vx *= -0.8
      this.x = Math.max(this.radius, Math.min(GAME_CONFIG.ARENA_WIDTH - this.radius, this.x))
    }
    if (this.y - this.radius <= 0 || this.y + this.radius >= GAME_CONFIG.ARENA_HEIGHT) {
      this.vy *= -0.8
      this.y = Math.max(this.radius, Math.min(GAME_CONFIG.ARENA_HEIGHT - this.radius, this.y))
    }

    // Apply friction
    this.vx *= 0.999
    this.vy *= 0.999

    // Minimum speed
    const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy)
    if (speed < GAME_CONFIG.MIN_SPEED && speed > 0) {
      const factor = GAME_CONFIG.MIN_SPEED / speed
      this.vx *= factor
      this.vy *= factor
    }
  }

  takeDamage(amount: number) {
    this.health = Math.max(0, this.health - amount)
    return this.health <= 0
  }

  getHealthColor() {
    const percent = this.health / this.maxHealth
    if (percent > 0.6) return '#00ff00'
    if (percent > 0.3) return '#ffff00'
    return '#ff0000'
  }
}

// Spatial Grid for collision optimization
class SpatialGrid {
  cellSize: number
  cols: number
  rows: number
  grid: Player[][][]

  constructor(width: number, height: number, cellSize: number = 50) {
    this.cellSize = cellSize
    this.cols = Math.ceil(width / cellSize)
    this.rows = Math.ceil(height / cellSize)
    this.grid = []
    this.clear()
  }

  clear() {
    this.grid = []
    for (let i = 0; i < this.rows; i++) {
      this.grid[i] = []
      for (let j = 0; j < this.cols; j++) {
        this.grid[i][j] = []
      }
    }
  }

  insert(player: Player) {
    const col = Math.floor(player.x / this.cellSize)
    const row = Math.floor(player.y / this.cellSize)
    
    if (row >= 0 && row < this.rows && col >= 0 && col < this.cols) {
      this.grid[row][col].push(player)
    }
  }

  getNearbyPlayers(player: Player): Player[] {
    const nearby: Player[] = []
    const col = Math.floor(player.x / this.cellSize)
    const row = Math.floor(player.y / this.cellSize)
    
    // Check 3x3 grid around player
    for (let r = Math.max(0, row - 1); r <= Math.min(this.rows - 1, row + 1); r++) {
      for (let c = Math.max(0, col - 1); c <= Math.min(this.cols - 1, col + 1); c++) {
        nearby.push(...this.grid[r][c])
      }
    }
    
    return nearby.filter(p => p !== player)
  }
}

// Game Engine
class GameEngine {
  players: Player[]
  gridCells: Array<{id: number, wallet: string, status: string, isWinner: boolean}>
  lastElimination: number
  winner: Player | null
  tokenHolders: Array<{wallet: string, balance: string}>
  frameCount: number
  spatialGrid: SpatialGrid

  constructor(tokenHolders: Array<{wallet: string, balance: string}>) {
    this.players = []
    this.gridCells = []
    this.lastElimination = Date.now()
    this.winner = null
    this.tokenHolders = tokenHolders
    this.frameCount = 0
    this.spatialGrid = new SpatialGrid(GAME_CONFIG.ARENA_WIDTH, GAME_CONFIG.ARENA_HEIGHT, 80)
    this.init()
  }

  init() {
    const colors = [
      '#FF006E', '#FB5607', '#FFBE0B', '#8338EC', '#3A86FF',
      '#06FFB4', '#FF4365', '#00F5FF', '#F72585', '#B5179E'
    ]

    const spawnPositions: Array<{x: number, y: number}> = []
    const minDistance = GAME_CONFIG.PLAYER_RADIUS * 4 // Minimum distance between spawns

    // Generate non-overlapping spawn positions
    this.tokenHolders.forEach((holder, index) => {
      const color = colors[index % colors.length]
      let x: number = 0
      let y: number = 0
      let attempts = 0
      const maxAttempts = 50

      do {
        // Spawn from random edge with more spread
        const edge = Math.floor(Math.random() * 4)
        const margin = GAME_CONFIG.PLAYER_RADIUS * 2
        
        switch (edge) {
          case 0: // Top
            x = margin + Math.random() * (GAME_CONFIG.ARENA_WIDTH - 2 * margin)
            y = margin
            break
          case 1: // Right
            x = GAME_CONFIG.ARENA_WIDTH - margin
            y = margin + Math.random() * (GAME_CONFIG.ARENA_HEIGHT - 2 * margin)
            break
          case 2: // Bottom
            x = margin + Math.random() * (GAME_CONFIG.ARENA_WIDTH - 2 * margin)
            y = GAME_CONFIG.ARENA_HEIGHT - margin
            break
          case 3: // Left
            x = margin
            y = margin + Math.random() * (GAME_CONFIG.ARENA_HEIGHT - 2 * margin)
            break
          default:
            x = GAME_CONFIG.ARENA_WIDTH / 2
            y = GAME_CONFIG.ARENA_HEIGHT / 2
        }

        attempts++
      } while (
        attempts < maxAttempts && 
        spawnPositions.some(pos => {
          const dx = pos.x - x
          const dy = pos.y - y
          return Math.sqrt(dx * dx + dy * dy) < minDistance
        })
      )

      // If we couldn't find a non-overlapping position, use random position in arena
      if (attempts >= maxAttempts) {
        x = GAME_CONFIG.PLAYER_RADIUS * 3 + Math.random() * (GAME_CONFIG.ARENA_WIDTH - GAME_CONFIG.PLAYER_RADIUS * 6)
        y = GAME_CONFIG.PLAYER_RADIUS * 3 + Math.random() * (GAME_CONFIG.ARENA_HEIGHT - GAME_CONFIG.PLAYER_RADIUS * 6)
      }

      spawnPositions.push({x, y})
      const player = new Player(index, x, y, color, holder.wallet)
      this.players.push(player)
    })

    console.log(`Spawned ${this.players.length} players in ${GAME_CONFIG.ARENA_WIDTH}x${GAME_CONFIG.ARENA_HEIGHT} arena`)
    this.updateGridCells()
  }

  updateGridCells() {
    this.gridCells = this.players.map(player => ({
      id: player.id,
      wallet: player.wallet.slice(-3),
      status: player.isAlive ? 'alive' : 'dead',
      isWinner: this.winner === player
    }))
  }

  update() {
    this.frameCount++
    
    const alivePlayers = this.players.filter(p => p.isAlive)
    const totalPlayers = this.players.length
    
    // Update all players with scaling parameters
    this.players.forEach(player => {
      if (player.isAlive) player.update(totalPlayers, alivePlayers.length, this.frameCount)
    })

    // Check player-to-player collisions ONLY
    this.checkCollisions()

    // Optional JITS elimination (disabled by default)
    if (GAME_CONFIG.JITS_ENABLED) {
      const now = Date.now()
      if (now - this.lastElimination > 2000) { // 2 seconds
        this.performJITS()
        this.lastElimination = now
      }
    }

    // Check for winner
    if (alivePlayers.length === 1 && !this.winner) {
      this.winner = alivePlayers[0]
      this.updateGridCells()
    }

    return {
      alive: alivePlayers.length,
      dead: this.players.length - alivePlayers.length
    }
  }

  checkCollisions() {
    const alivePlayers = this.players.filter(p => p.isAlive)
    
    // Clear and populate spatial grid
    this.spatialGrid.clear()
    alivePlayers.forEach(player => this.spatialGrid.insert(player))
    
    // Check collisions using spatial partitioning
    const checkedPairs = new Set<string>()
    
    for (const p1 of alivePlayers) {
      const nearbyPlayers = this.spatialGrid.getNearbyPlayers(p1)
      
      for (const p2 of nearbyPlayers) {
        if (!p2.isAlive) continue
        
        // Avoid duplicate checks
        const pairKey = `${Math.min(p1.id, p2.id)}-${Math.max(p1.id, p2.id)}`
        if (checkedPairs.has(pairKey)) continue
        checkedPairs.add(pairKey)
        
        const dx = p2.x - p1.x
        const dy = p2.y - p1.y
        const distance = Math.sqrt(dx * dx + dy * dy)
        const minDistance = p1.radius + p2.radius
        
        if (distance < minDistance && distance > 0) {
          // Prevent multiple damage applications in the same frame
          const collisionKey = `${Math.min(p1.id, p2.id)}-${Math.max(p1.id, p2.id)}`
          
          // Calculate relative collision velocity
          const relativeVx = p1.vx - p2.vx
          const relativeVy = p1.vy - p2.vy
          const relativeSpeed = Math.sqrt(relativeVx * relativeVx + relativeVy * relativeVy)
          
          // Only apply damage if neither player was damaged this frame
          if (p1.lastCollisionFrame < this.frameCount && p2.lastCollisionFrame < this.frameCount) {
            // Calculate velocity-based damage (0-85 based on max velocity of 500px/s)
            const velocityRatio = Math.min(relativeSpeed / GAME_CONFIG.MAX_VELOCITY, 1.0)
            const velocityDamage = velocityRatio * 85 // Max 85 damage from velocity
            const totalDamage = GAME_CONFIG.BASE_DAMAGE + velocityDamage
            
            console.log(`💥 Collision! Players ${p1.id} vs ${p2.id}, Speed: ${relativeSpeed.toFixed(1)}px/s, Damage: ${totalDamage.toFixed(1)}`)
            console.log(`  P1 Health: ${p1.health.toFixed(1)} -> ${(p1.health - totalDamage).toFixed(1)}`)
            console.log(`  P2 Health: ${p2.health.toFixed(1)} -> ${(p2.health - totalDamage).toFixed(1)}`)
            
            // Mark collision frame
            p1.lastCollisionFrame = this.frameCount
            p2.lastCollisionFrame = this.frameCount
            
            // Apply damage to both players
            const p1Died = p1.takeDamage(totalDamage)
            const p2Died = p2.takeDamage(totalDamage)
            
            if (p1Died) {
              p1.isAlive = false
              console.log(`🔥 Player ${p1.id} (${p1.wallet.slice(-4)}) ELIMINATED by collision!`)
              this.updateGridCells()
            }
            if (p2Died) {
              p2.isAlive = false
              console.log(`🔥 Player ${p2.id} (${p2.wallet.slice(-4)}) ELIMINATED by collision!`)
              this.updateGridCells()
            }
          }

          // Physics response - separate overlapping players
          const overlap = minDistance - distance
          const separationX = (dx / distance) * overlap * 0.5
          const separationY = (dy / distance) * overlap * 0.5
          
          p1.x -= separationX
          p1.y -= separationY
          p2.x += separationX
          p2.y += separationY
          
          // Elastic collision response
          const angle = Math.atan2(dy, dx)
          const cos = Math.cos(angle)
          const sin = Math.sin(angle)
          
          // Rotate velocities to collision coordinate system
          const v1x = p1.vx * cos + p1.vy * sin
          const v1y = -p1.vx * sin + p1.vy * cos
          const v2x = p2.vx * cos + p2.vy * sin
          const v2y = -p2.vx * sin + p2.vy * cos
          
          // Apply collision (exchange x-velocities, keep y-velocities)
          const newV1x = v2x * 0.8 // Energy loss factor
          const newV2x = v1x * 0.8
          
          // Rotate back to world coordinates
          p1.vx = newV1x * cos - v1y * sin
          p1.vy = newV1x * sin + v1y * cos
          p2.vx = newV2x * cos - v2y * sin
          p2.vy = newV2x * sin + v2y * cos
        }
      }
    }
  }

  performJITS() {
    const alivePlayers = this.players.filter(p => p.isAlive)
    if (alivePlayers.length <= 1) return

    let toEliminate = []
    if (alivePlayers.length > 10) {
      const count = Math.max(1, Math.floor(alivePlayers.length * 0.1))
      const shuffled = [...alivePlayers].sort(() => Math.random() - 0.5)
      toEliminate = shuffled.slice(0, count)
    } else {
      toEliminate = [alivePlayers[Math.floor(Math.random() * alivePlayers.length)]]
    }

    toEliminate.forEach(player => {
      player.isAlive = false
      this.updateGridCells()
    })
  }

  render(ctx: CanvasRenderingContext2D) {
    // Clear canvas
    ctx.fillStyle = '#000000'
    ctx.fillRect(0, 0, GAME_CONFIG.ARENA_WIDTH, GAME_CONFIG.ARENA_HEIGHT)

    const alivePlayers = this.players.filter(p => p.isAlive)
    
    // Performance optimization: Skip rendering details if too many players
    const shouldRenderTrails = alivePlayers.length < 1000
    const shouldRenderHealthBars = alivePlayers.length < 2000
    const shouldRenderWallets = alivePlayers.length < 500

    // Draw grid
    ctx.strokeStyle = 'rgba(0, 255, 0, 0.1)'
    ctx.lineWidth = 1
    for (let x = 0; x < GAME_CONFIG.ARENA_WIDTH; x += 100) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, GAME_CONFIG.ARENA_HEIGHT)
      ctx.stroke()
    }
    for (let y = 0; y < GAME_CONFIG.ARENA_HEIGHT; y += 100) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(GAME_CONFIG.ARENA_WIDTH, y)
      ctx.stroke()
    }

    // Draw trails (only if not too many players)
    if (shouldRenderTrails) {
      ctx.strokeStyle = '#ffffff20'
      ctx.lineWidth = 1
      alivePlayers.forEach(player => {
        if (player.trail.length < 2) return
        ctx.beginPath()
        ctx.moveTo(player.trail[0].x, player.trail[0].y)
        for (let i = 1; i < player.trail.length; i++) {
          ctx.lineTo(player.trail[i].x, player.trail[i].y)
        }
        ctx.stroke()
      })
    }

    // Draw players (batched by color for performance)
    const playersByColor = new Map<string, Player[]>()
    alivePlayers.forEach(player => {
      if (!playersByColor.has(player.color)) {
        playersByColor.set(player.color, [])
      }
      playersByColor.get(player.color)!.push(player)
    })

    // Render players by color batches
    playersByColor.forEach((players, color) => {
      ctx.fillStyle = color
      ctx.beginPath()
      players.forEach(player => {
        ctx.moveTo(player.x + player.radius, player.y)
        ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2)
      })
      ctx.fill()
    })

    // Draw health bars (only if not too many players)
    if (shouldRenderHealthBars) {
      alivePlayers.forEach(player => {
        const barWidth = player.radius * 2
        const barHeight = 2
        const barX = player.x - barWidth / 2
        const barY = player.y - player.radius - 6

        ctx.fillStyle = '#333'
        ctx.fillRect(barX, barY, barWidth, barHeight)
        
        ctx.fillStyle = player.getHealthColor()
        ctx.fillRect(barX, barY, barWidth * (player.health / player.maxHealth), barHeight)
      })
    }

    // Draw wallet suffixes (only if few players)
    if (shouldRenderWallets) {
      ctx.fillStyle = '#ffffff'
      ctx.font = '8px monospace'
      ctx.textAlign = 'center'
      alivePlayers.forEach(player => {
        ctx.fillText(player.wallet.slice(-3), player.x, player.y - player.radius - 10)
      })
    }

    // Winner effects
    if (this.winner) {
      ctx.save()
      ctx.globalAlpha = 0.3 + Math.sin(Date.now() * 0.01) * 0.2
      ctx.fillStyle = '#FFD700'
      ctx.beginPath()
      ctx.arc(this.winner.x, this.winner.y, this.winner.radius * 2, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()

      // Winner text
      ctx.fillStyle = '#ffd700'
      ctx.font = 'bold 36px monospace'
      ctx.textAlign = 'center'
      ctx.shadowColor = '#ffd700'
      ctx.shadowBlur = 20
      ctx.fillText('🏆 WINNER! 🏆', GAME_CONFIG.ARENA_WIDTH/2, 60)
      
      ctx.font = '18px monospace'
      ctx.fillStyle = '#ffffff'
      ctx.fillText(this.winner.wallet, GAME_CONFIG.ARENA_WIDTH/2, 90)
      
      ctx.font = '24px monospace'
      ctx.fillStyle = '#00ff00'
      ctx.fillText('WINS $100,000', GAME_CONFIG.ARENA_WIDTH/2, 120)
    }

    // Performance indicator
    ctx.fillStyle = '#00ff00'
    ctx.font = '12px monospace'
    ctx.textAlign = 'left'
    ctx.shadowBlur = 0
    ctx.fillText(`Players: ${alivePlayers.length}`, 10, 20)
    ctx.fillText(`Total: ${this.players.length}`, 10, 35)
  }
}

interface GridCellProps {
  data?: {
    id: number
    wallet: string
    status: string
    isWinner: boolean
  }
}

const GridCell: React.FC<GridCellProps> = ({ data }) => {
  if (!data) return <div className="w-7 h-7 bg-gray-900/30 border border-gray-700 rounded-sm" />
  
  return (
    <div className={`w-7 h-7 border rounded-sm flex flex-col items-center justify-center text-xs ${
      data.status === 'alive' 
        ? 'bg-green-500/20 border-green-500' 
        : data.status === 'dead'
        ? 'bg-red-500/20 border-red-500'
        : 'bg-gray-900/30 border-gray-700'
    } ${data.isWinner ? 'bg-yellow-500/30 border-yellow-500 animate-pulse' : ''}`}>
      {data.status === 'alive' && (
        <>
          <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          <div className="text-[6px] text-white">{data.wallet}</div>
        </>
      )}
      {data.status === 'dead' && <div className="text-xs">💀</div>}
      {data.isWinner && <div className="text-xs">🏆</div>}
    </div>
  )
}

export default function SolArenaGame() {
  const [gameState, setGameState] = useState<'setup' | 'playing' | 'ended'>('setup')
  const [tokenInfo, setTokenInfo] = useState<{name: string, symbol: string, decimals: number} | null>(null)
  const [eligiblePlayers, setEligiblePlayers] = useState<Array<{wallet: string, balance: string}>>([])
  const [setupForm, setSetupForm] = useState({
    contractAddress: '',
    minThreshold: '100'
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [stats, setStats] = useState({ alive: 0, dead: 0 })
  
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const gameEngineRef = useRef<GameEngine | null>(null)
  const animationRef = useRef<number | null>(null)

  const fetchTokenMetadata = async (mintAddress: string) => {
    try {
      if (!HELIUS_API_KEY) {
        return { name: 'Demo Token', symbol: 'DEMO', decimals: 6 }
      }

      const response = await fetch(`https://api.helius.xyz/v0/token-metadata?api-key=${HELIUS_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mintAccounts: [mintAddress]
        })
      })

      if (!response.ok) {
        throw new Error(`Metadata API error: ${response.status}`)
      }

      const data = await response.json()
      
      if (data && data.length > 0) {
        const metadata = data[0]
        return {
          name: metadata.onChainMetadata?.metadata?.data?.name || 'Unknown Token',
          symbol: metadata.onChainMetadata?.metadata?.data?.symbol || 'UNK',
          decimals: 6, // Pump.fun tokens always use 6 decimals
          image: metadata.offChainMetadata?.metadata?.image
        }
      }

      return { name: 'Unknown Token', symbol: 'UNK', decimals: 6 }
    } catch (error) {
      console.error('Error fetching token metadata:', error)
      return { name: 'Unknown Token', symbol: 'UNK', decimals: 6 }
    }
  }

  const handleSearchToken = async () => {
    if (!setupForm.contractAddress) {
      setError('Please enter a token contract address')
      return
    }

    // Basic validation for Solana address format
    if (setupForm.contractAddress.length < 32 || setupForm.contractAddress.length > 44) {
      setError('Invalid Solana token address format')
      return
    }

    setLoading(true)
    setError('')

    try {
      // Fetch token metadata first
      const metadata = await fetchTokenMetadata(setupForm.contractAddress)
      setTokenInfo(metadata)
      
      // Fetch eligible holders
      const holders = await fetchTokenHolders(
        setupForm.contractAddress,
        setupForm.minThreshold
      )
      
      setEligiblePlayers(holders)
      
      if (holders.length === 0) {
        setError('No holders found meeting the minimum threshold')
      } else if (holders.length < 2) {
        setError('Need at least 2 eligible players to start a battle')
      }
    } catch (err) {
      console.error('Token search error:', err)
      setError('Failed to fetch token information. Please check the contract address.')
    } finally {
      setLoading(false)
    }
  }

  const startGame = () => {
    if (eligiblePlayers.length < 2) {
      setError('Need at least 2 eligible players to start')
      return
    }

    gameEngineRef.current = new GameEngine(eligiblePlayers)
    setGameState('playing')
  }

  useEffect(() => {
    if (gameState !== 'playing' || !canvasRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const engine = gameEngineRef.current

    if (!ctx || !engine) return

    const animate = () => {
      const stats = engine.update()
      setStats(stats)
      engine.render(ctx)
      
      if (engine.winner) {
        setTimeout(() => setGameState('ended'), 3000)
      } else {
        animationRef.current = requestAnimationFrame(animate)
      }
    }

    animationRef.current = requestAnimationFrame(animate)

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [gameState])

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 text-green-400 font-mono overflow-hidden">
      {gameState === 'setup' && (
        <div className="max-w-4xl mx-auto p-8 text-center">
          <h1 className="text-6xl font-bold mb-4 text-green-400 animate-pulse drop-shadow-[0_0_20px_rgba(0,255,0,0.8)]">
            ⚔️ SOL ARENA ⚔️
          </h1>
          <p className="text-xl mb-8 text-green-300">Token-Gated Battle Royale</p>
          
          <Card className="bg-black/80 border-green-500 shadow-[0_0_30px_rgba(0,255,0,0.3)]">
            <CardHeader>
              <CardTitle className="text-green-400">Setup Battle Arena</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Input
                  type="text"
                  placeholder="Enter pump.fun contract address (e.g., 7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr)"
                  value={setupForm.contractAddress}
                  onChange={(e) => setSetupForm({...setupForm, contractAddress: e.target.value.trim()})}
                  className="bg-green-500/10 border-green-500 text-green-400 placeholder:text-green-400/60 font-mono text-sm"
                />
                <p className="text-xs text-green-400/60">
                  Enter a valid Solana token mint address (32-44 characters)
                </p>
              </div>
              
              <Input
                type="number"
                placeholder="Minimum tokens required (e.g., 100)"
                value={setupForm.minThreshold}
                onChange={(e) => setSetupForm({...setupForm, minThreshold: e.target.value})}
                className="bg-green-500/10 border-green-500 text-green-400 placeholder:text-green-400/60"
                min="0"
                step="0.000001"
              />
              
              <Button 
                onClick={handleSearchToken} 
                disabled={loading || !setupForm.contractAddress}
                className="bg-green-500 hover:bg-green-400 text-black font-bold w-full"
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                    Fetching Token Data...
                  </div>
                ) : 'Search Token & Find Holders'}
              </Button>

              {tokenInfo && (
                <div className="bg-green-500/5 border border-green-500/30 rounded p-4 space-y-2">
                  <h3 className="text-green-400 font-bold">Token Found:</h3>
                  <div className="text-sm space-y-1">
                    <p><span className="text-green-300">Name:</span> {tokenInfo.name}</p>
                    <p><span className="text-green-300">Symbol:</span> {tokenInfo.symbol}</p>
                    <p><span className="text-green-300">Decimals:</span> {tokenInfo.decimals}</p>
                    <p><span className="text-green-300">Eligible Players:</span> {eligiblePlayers.length}</p>
                    <p><span className="text-green-300">Min Threshold:</span> {setupForm.minThreshold} {tokenInfo.symbol}</p>
                  </div>
                </div>
              )}
              
              {eligiblePlayers.length > 0 && (
                <Button 
                  onClick={startGame}
                  className="bg-gradient-to-r from-green-500 to-green-400 hover:from-green-400 hover:to-green-300 text-black font-bold text-lg px-8 py-4 w-full shadow-lg"
                >
                  🚀 LAUNCH BATTLE ROYALE
                  <div className="text-sm font-normal">({eligiblePlayers.length} Eligible Players)</div>
                </Button>
              )}
              
              {error && (
                <div className="text-red-400 bg-red-500/10 border border-red-500 rounded p-3 text-sm">
                  <div className="font-bold mb-1">⚠️ Error:</div>
                  {error}
                </div>
              )}

              {!HELIUS_API_KEY && (
                <div className="text-yellow-400 bg-yellow-500/10 border border-yellow-500 rounded p-3 text-sm">
                  <div className="font-bold mb-1">🔧 Demo Mode:</div>
                  No Helius API key detected. Using mock data for demonstration.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {gameState === 'playing' && (
        <div className="flex gap-5 p-5 h-screen items-center justify-center">
          <Card className="w-80 bg-black/90 border-green-500 shadow-[0_0_30px_rgba(0,255,0,0.3)]">
            <CardHeader>
              <CardTitle className="text-center text-green-400">⚔️ BATTLE STATUS ⚔️</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-10 gap-0.5 mb-4 p-2 bg-black/50 rounded">
                {gameEngineRef.current?.gridCells.map((cell, i) => (
                  <GridCell key={i} data={cell} />
                ))}
              </div>
              <div className="text-center space-y-2">
                <div className="text-green-400">
                  Alive: {stats.alive} | Dead: {stats.dead}
                </div>
                <div className="text-xs text-green-300 space-y-1">
                  <div>💥 Collision-Only Damage</div>
                  <div>🚫 No Auto-Elimination</div>
                  <div>⚡ Max Speed: 500px/s</div>
                  {(() => {
                    const totalPlayers = eligiblePlayers.length
                    const eliminationPercentage = (totalPlayers - stats.alive) / totalPlayers
                    let sizeText = "🔴 Normal Size"
                    
                    if (eliminationPercentage >= 0.25 && eliminationPercentage < 0.5) {
                      sizeText = "🟡 +25% Size"
                    } else if (eliminationPercentage >= 0.5 && eliminationPercentage < 0.75) {
                      sizeText = "🟠 +50% Size"
                    } else if (eliminationPercentage >= 0.75 && stats.alive > 5) {
                      sizeText = "🔥 +75% Size"
                    } else if (stats.alive <= 5) {
                      sizeText = "⭐ DOUBLE SIZE!"
                    }
                    
                    return <div>{sizeText}</div>
                  })()}
                </div>
              </div>
            </CardContent>
          </Card>

          <canvas
            ref={canvasRef}
            width={GAME_CONFIG.ARENA_WIDTH}
            height={GAME_CONFIG.ARENA_HEIGHT}
            className="border-2 border-green-500 rounded shadow-[0_0_30px_rgba(0,255,0,0.5)] bg-black"
          />
        </div>
      )}

      {gameState === 'ended' && (
        <div className="flex flex-col items-center justify-center h-screen text-center">
          <h2 className="text-8xl text-yellow-400 animate-pulse drop-shadow-[0_0_30px_rgba(255,215,0,0.8)] mb-5">
            🏆 WINNER! 🏆
          </h2>
          <p className="text-2xl text-white mb-8 break-all max-w-4xl">
            {gameEngineRef.current?.winner?.wallet}
          </p>
          <p className="text-3xl text-green-400 mb-8 font-bold">
            WINS $100,000
          </p>
          <Button 
            onClick={() => setGameState('setup')}
            className="bg-green-500 hover:bg-green-400 text-black font-bold text-xl px-8 py-4"
          >
            New Game
          </Button>
        </div>
      )}
    </div>
  )
}
