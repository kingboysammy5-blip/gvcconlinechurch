import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  LogIn,
  Pause,
  Play,
  RotateCcw,
  Trophy,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  recordGameRunAndSyncLeaderboard,
  SanctuaryLeaderboardEntry,
  subscribeSanctuaryLeaderboard,
} from '../../lib/firestoreStore';
import backdropImg from '../../assets/images/sanctuary_game_backdrop_1795030883356.jpg';

type GameState = 'TITLE_MENU' | 'PLAYING' | 'PAUSED' | 'GAME_OVER';

interface SanctuaryGameProps {
  onBackToSite: () => void;
}

interface Lamb {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  state: 'wandering' | 'following' | 'rescued';
  wobble: number;
}

interface ShadowWolf {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  speed: number;
  windupTimer: number;
  lungeTimer: number;
  stunTimer: number;
  tx: number;
  ty: number;
}

interface Pickup {
  id: number;
  x: number;
  y: number;
  kind: 'oil' | 'scroll';
  bob: number;
}

interface Particle {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  radius: number;
  color: string;
}

interface PulseRing {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  alpha: number;
}

class SoundEngine {
  private ctx: AudioContext | null = null;
  public muted = false;

  private ensureContext(): AudioContext | null {
    if (this.muted) return null;
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  playTone(freq: number, duration: number, type: OscillatorType = 'sine', gainVal = 0.08, endFreq?: number) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (endFreq) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(40, endFreq), now + duration);
    }
    gain.gain.setValueAtTime(gainVal, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration);
  }

  playPickup() {
    this.playTone(587.33, 0.14, 'triangle', 0.09, 880);
  }

  playLambSaved() {
    this.playTone(523.25, 0.12, 'sine', 0.08);
    setTimeout(() => this.playTone(659.25, 0.16, 'sine', 0.08), 70);
    setTimeout(() => this.playTone(783.99, 0.22, 'sine', 0.08), 140);
  }

  playBeaconPulse() {
    this.playTone(220, 0.28, 'sine', 0.1, 440);
  }

  playHurt() {
    this.playTone(170, 0.24, 'sawtooth', 0.09, 75);
  }

  playWaveClear() {
    [440, 554.37, 659.25, 880].forEach((f, idx) => {
      setTimeout(() => this.playTone(f, 0.18, 'triangle', 0.07), idx * 65);
    });
  }

  dispose() {
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }
  }
}

export const SanctuaryGame: React.FC<SanctuaryGameProps> = ({ onBackToSite }) => {
  const { firebaseUser, firestoreProfile, signInWithGoogle, refreshFirestoreProfile } = useAuth();

  const [gameState, setGameState] = useState<GameState>('TITLE_MENU');
  const [muted, setMuted] = useState(false);
  const [hud, setHud] = useState({
    score: 0,
    wave: 1,
    lambsSaved: 0,
    lantern: 100,
    combo: 1,
    pulseReady: true,
    durationSeconds: 0,
  });
  const [leaderboard, setLeaderboard] = useState<SanctuaryLeaderboardEntry[]>([]);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [showLeaderboardModal, setShowLeaderboardModal] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const soundRef = useRef<SoundEngine | null>(null);
  const stateRef = useRef<GameState>('TITLE_MENU');

  // Mutable simulation state isolated inside ref for 60fps loop
  const simRef = useRef({
    width: 1200,
    height: 760,
    playerX: 600,
    playerY: 380,
    playerSpeed: 285,
    playerInvuln: 0,
    hitFlash: 0,
    shakeMag: 0,
    foldX: 600,
    foldY: 380,
    foldRadius: 56,
    lantern: 100,
    score: 0,
    wave: 1,
    waveTargetLambs: 5,
    waveProgressLambs: 0,
    lambsSaved: 0,
    combo: 1,
    comboTimer: 0,
    pulseCooldown: 0,
    elapsedSeconds: 0,
    nextEntityId: 1,
    lambSpawnTimer: 0.4,
    wolfSpawnTimer: 2.2,
    pickupSpawnTimer: 3.5,
    lambs: [] as Lamb[],
    wolves: [] as ShadowWolf[],
    pickups: [] as Pickup[],
    rings: [] as PulseRing[],
    particles: Array.from({ length: 80 }, () => ({
      active: false,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      life: 0,
      maxLife: 1,
      radius: 2,
      color: '#FBBF24',
    })) as Particle[],
    keys: new Set<string>(),
    pointerActive: false,
    pointerX: 600,
    pointerY: 380,
    hudSyncAccum: 0,
  });

  useEffect(() => {
    soundRef.current = new SoundEngine();
    return () => {
      soundRef.current?.dispose();
    };
  }, []);

  useEffect(() => {
    if (soundRef.current) {
      soundRef.current.muted = muted;
    }
  }, [muted]);

  useEffect(() => {
    const unsub = subscribeSanctuaryLeaderboard(
      (entries) => setLeaderboard(entries),
      () => {}
    );
    return () => unsub();
  }, []);

  const spawnParticles = useCallback((x: number, y: number, count: number, color: string, speed = 130) => {
    const pool = simRef.current.particles;
    let spawned = 0;
    for (let i = 0; i < pool.length && spawned < count; i++) {
      if (!pool[i].active) {
        const angle = Math.random() * Math.PI * 2;
        const mag = (0.35 + Math.random() * 0.85) * speed;
        pool[i].active = true;
        pool[i].x = x;
        pool[i].y = y;
        pool[i].vx = Math.cos(angle) * mag;
        pool[i].vy = Math.sin(angle) * mag;
        pool[i].life = 0.45 + Math.random() * 0.35;
        pool[i].maxLife = pool[i].life;
        pool[i].radius = 2 + Math.random() * 3;
        pool[i].color = color;
        spawned++;
      }
    }
  }, []);

  const resetSimulation = useCallback(() => {
    const canvas = canvasRef.current;
    const w = canvas ? canvas.clientWidth || window.innerWidth : window.innerWidth;
    const h = canvas ? canvas.clientHeight || window.innerHeight : window.innerHeight;
    const s = simRef.current;
    s.width = w;
    s.height = h;
    s.foldX = w / 2;
    s.foldY = h / 2;
    s.playerX = w / 2;
    s.playerY = h / 2 + 88;
    s.playerInvuln = 0;
    s.hitFlash = 0;
    s.shakeMag = 0;
    s.lantern = 100;
    s.score = 0;
    s.wave = 1;
    s.waveTargetLambs = 5;
    s.waveProgressLambs = 0;
    s.lambsSaved = 0;
    s.combo = 1;
    s.comboTimer = 0;
    s.pulseCooldown = 0;
    s.elapsedSeconds = 0;
    s.lambSpawnTimer = 0.25;
    s.wolfSpawnTimer = 2.0;
    s.pickupSpawnTimer = 3.0;
    s.lambs = [];
    s.wolves = [];
    s.pickups = [];
    s.rings = [];
    s.particles.forEach((p) => (p.active = false));
    s.keys.clear();
    s.pointerActive = false;

    setSaveStatus('idle');
    setSaveMessage(null);
    setHud({
      score: 0,
      wave: 1,
      lambsSaved: 0,
      lantern: 100,
      combo: 1,
      pulseReady: true,
      durationSeconds: 0,
    });
  }, []);

  const persistGameScore = useCallback(
    async (finalStats: { score: number; wave: number; lambsSaved: number; durationSeconds: number }) => {
      if (!firebaseUser || !firebaseUser.emailVerified) {
        return;
      }
      setSaveStatus('saving');
      setSaveMessage(null);
      try {
        await recordGameRunAndSyncLeaderboard(firebaseUser, finalStats);
        await refreshFirestoreProfile();
        setSaveStatus('saved');
        setSaveMessage('Run synced to your Firestore profile and Sanctuary leaderboard.');
      } catch (err: any) {
        setSaveStatus('error');
        setSaveMessage(err?.message || 'Could not sync run to Firestore.');
      }
    },
    [firebaseUser, refreshFirestoreProfile]
  );

  const startGame = useCallback(() => {
    resetSimulation();
    stateRef.current = 'PLAYING';
    setGameState('PLAYING');
    soundRef.current?.playWaveClear();
  }, [resetSimulation]);

  const togglePause = useCallback(() => {
    if (stateRef.current === 'PLAYING') {
      simRef.current.keys.clear();
      simRef.current.pointerActive = false;
      stateRef.current = 'PAUSED';
      setGameState('PAUSED');
    } else if (stateRef.current === 'PAUSED') {
      stateRef.current = 'PLAYING';
      setGameState('PLAYING');
    }
  }, []);

  const triggerBeaconPulse = useCallback(() => {
    if (stateRef.current !== 'PLAYING') return;
    const s = simRef.current;
    if (s.pulseCooldown > 0) return;

    s.pulseCooldown = 2.6;
    s.shakeMag = Math.max(s.shakeMag, 4.5);
    s.rings.push({
      x: s.playerX,
      y: s.playerY,
      radius: 26,
      maxRadius: 215,
      alpha: 1,
    });
    soundRef.current?.playBeaconPulse();
    spawnParticles(s.playerX, s.playerY, 18, '#FCD34D', 175);

    // Call nearby lambs to follow and knock back + stun shadow wolves inside radius
    for (const lamb of s.lambs) {
      const dist = Math.hypot(lamb.x - s.playerX, lamb.y - s.playerY);
      if (dist <= 230 && lamb.state === 'wandering') {
        lamb.state = 'following';
        spawnParticles(lamb.x, lamb.y, 6, '#FEF3C7', 75);
      }
    }
    for (const wolf of s.wolves) {
      const dx = wolf.x - s.playerX;
      const dy = wolf.y - s.playerY;
      const dist = Math.hypot(dx, dy) || 1;
      if (dist <= 220) {
        wolf.stunTimer = 1.65;
        wolf.windupTimer = 0;
        wolf.lungeTimer = 0;
        wolf.x += (dx / dist) * 62;
        wolf.y += (dy / dist) * 62;
        spawnParticles(wolf.x, wolf.y, 10, '#F59E0B', 140);
      }
    }
  }, [spawnParticles]);

  // Keyboard Listeners (held movement vs edge-triggered pulse/pause/start + blur cleanup)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
        if (stateRef.current === 'PLAYING' || stateRef.current === 'PAUSED') {
          e.preventDefault();
          togglePause();
        }
        return;
      }
      if (stateRef.current === 'TITLE_MENU' && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        startGame();
        return;
      }
      if (stateRef.current === 'PLAYING') {
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
          e.preventDefault();
        }
        if (e.key === ' ' && !e.repeat) {
          triggerBeaconPulse();
          return;
        }
        simRef.current.keys.add(e.key.toLowerCase());
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      simRef.current.keys.delete(e.key.toLowerCase());
    };

    const onBlur = () => {
      simRef.current.keys.clear();
      simRef.current.pointerActive = false;
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [startGame, togglePause, triggerBeaconPulse]);

  // 60FPS Canvas Animation Loop with Delta Time Clamping
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;
    let lastTs = performance.now();

    const resizeCanvas = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const w = parent.clientWidth;
      const h = parent.clientHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      simRef.current.width = w;
      simRef.current.height = h;
      simRef.current.foldX = w / 2;
      simRef.current.foldY = h / 2;
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const spawnPerimeterPoint = (w: number, h: number, margin = 48) => {
      const edge = Math.floor(Math.random() * 4);
      if (edge === 0) return { x: margin + Math.random() * (w - margin * 2), y: margin };
      if (edge === 1) return { x: w - margin, y: margin + Math.random() * (h - margin * 2) };
      if (edge === 2) return { x: margin + Math.random() * (w - margin * 2), y: h - margin };
      return { x: margin, y: margin + Math.random() * (h - margin * 2) };
    };

    const stepSimulation = (dt: number) => {
      const s = simRef.current;
      const w = s.width;
      const h = s.height;

      s.elapsedSeconds += dt;
      s.lantern = Math.max(0, s.lantern - (1.85 + s.wave * 0.25) * dt);
      if (s.playerInvuln > 0) s.playerInvuln = Math.max(0, s.playerInvuln - dt);
      if (s.hitFlash > 0) s.hitFlash = Math.max(0, s.hitFlash - dt * 5);
      if (s.shakeMag > 0) s.shakeMag = Math.max(0, s.shakeMag - dt * 24);
      if (s.pulseCooldown > 0) s.pulseCooldown = Math.max(0, s.pulseCooldown - dt);
      if (s.comboTimer > 0) {
        s.comboTimer = Math.max(0, s.comboTimer - dt);
        if (s.comboTimer === 0) s.combo = 1;
      }

      // Check Game Over
      if (s.lantern <= 0) {
        s.lantern = 0;
        stateRef.current = 'GAME_OVER';
        setGameState('GAME_OVER');
        soundRef.current?.playHurt();
        const finalStats = {
          score: Math.round(s.score),
          wave: s.wave,
          lambsSaved: s.lambsSaved,
          durationSeconds: Math.round(s.elapsedSeconds),
        };
        setHud({
          ...finalStats,
          lantern: 0,
          combo: s.combo,
          pulseReady: true,
        });
        persistGameScore(finalStats);
        return;
      }

      // Player Movement (Keyboard or Pointer)
      let moveX = 0;
      let moveY = 0;
      if (s.keys.has('w') || s.keys.has('arrowup')) moveY -= 1;
      if (s.keys.has('s') || s.keys.has('arrowdown')) moveY += 1;
      if (s.keys.has('a') || s.keys.has('arrowleft')) moveX -= 1;
      if (s.keys.has('d') || s.keys.has('arrowright')) moveX += 1;

      if (moveX !== 0 || moveY !== 0) {
        const len = Math.hypot(moveX, moveY);
        s.playerX += (moveX / len) * s.playerSpeed * dt;
        s.playerY += (moveY / len) * s.playerSpeed * dt;
      } else if (s.pointerActive) {
        const dx = s.pointerX - s.playerX;
        const dy = s.pointerY - s.playerY;
        const dist = Math.hypot(dx, dy);
        if (dist > 8) {
          s.playerX += (dx / dist) * Math.min(s.playerSpeed * dt, dist);
          s.playerY += (dy / dist) * Math.min(s.playerSpeed * dt, dist);
        }
      }
      s.playerX = Math.max(24, Math.min(w - 24, s.playerX));
      s.playerY = Math.max(76, Math.min(h - 24, s.playerY));

      // Spawn Lambs
      s.lambSpawnTimer -= dt;
      const maxActiveLambs = 3 + Math.min(4, s.wave);
      if (s.lambSpawnTimer <= 0 && s.lambs.length < maxActiveLambs) {
        const p = spawnPerimeterPoint(w, h, 72);
        s.lambs.push({
          id: s.nextEntityId++,
          x: p.x,
          y: p.y,
          vx: (Math.random() - 0.5) * 26,
          vy: (Math.random() - 0.5) * 26,
          state: 'wandering',
          wobble: Math.random() * Math.PI * 2,
        });
        s.lambSpawnTimer = Math.max(1.6, 3.8 - s.wave * 0.2);
      }

      // Spawn Pickups
      s.pickupSpawnTimer -= dt;
      if (s.pickupSpawnTimer <= 0 && s.pickups.length < 3) {
        const angle = Math.random() * Math.PI * 2;
        const radius = 110 + Math.random() * Math.min(w, h) * 0.28;
        s.pickups.push({
          id: s.nextEntityId++,
          x: Math.max(56, Math.min(w - 56, s.foldX + Math.cos(angle) * radius)),
          y: Math.max(96, Math.min(h - 56, s.foldY + Math.sin(angle) * radius)),
          kind: Math.random() < 0.65 ? 'oil' : 'scroll',
          bob: Math.random() * Math.PI * 2,
        });
        s.pickupSpawnTimer = 5.2;
      }

      // Spawn Shadow Wolves with difficulty ramp
      s.wolfSpawnTimer -= dt;
      const maxWolves = 2 + Math.min(6, s.wave);
      if (s.wolfSpawnTimer <= 0 && s.wolves.length < maxWolves) {
        const p = spawnPerimeterPoint(w, h, 26);
        s.wolves.push({
          id: s.nextEntityId++,
          x: p.x,
          y: p.y,
          vx: 0,
          vy: 0,
          speed: 78 + s.wave * 11,
          windupTimer: 0,
          lungeTimer: 0,
          stunTimer: 0,
          tx: s.playerX,
          ty: s.playerY,
        });
        s.wolfSpawnTimer = Math.max(1.8, 4.8 - s.wave * 0.35);
      }

      // Update Lambs
      for (let i = s.lambs.length - 1; i >= 0; i--) {
        const lamb = s.lambs[i];
        lamb.wobble += dt * 4;
        const distToPlayer = Math.hypot(s.playerX - lamb.x, s.playerY - lamb.y);
        if (distToPlayer < 105 && lamb.state === 'wandering') {
          lamb.state = 'following';
          soundRef.current?.playPickup();
        }

        if (lamb.state === 'following') {
          const dx = s.playerX - lamb.x;
          const dy = s.playerY - lamb.y;
          const d = Math.hypot(dx, dy) || 1;
          if (d > 34) {
            lamb.x += (dx / d) * 185 * dt;
            lamb.y += (dy / d) * 185 * dt;
          }
        } else {
          lamb.x += lamb.vx * dt;
          lamb.y += lamb.vy * dt;
          if (lamb.x < 40 || lamb.x > w - 40) lamb.vx *= -1;
          if (lamb.y < 85 || lamb.y > h - 40) lamb.vy *= -1;
        }

        // Check Sanctuary Fold rescue
        const distToFold = Math.hypot(lamb.x - s.foldX, lamb.y - s.foldY);
        if (distToFold < s.foldRadius) {
          s.lambsSaved += 1;
          s.waveProgressLambs += 1;
          s.combo = Math.min(5, s.combo + 1);
          s.comboTimer = 6.5;
          s.score += 100 * s.combo;
          s.lantern = Math.min(100, s.lantern + 9);
          soundRef.current?.playLambSaved();
          spawnParticles(lamb.x, lamb.y, 16, '#34D399', 140);
          s.lambs.splice(i, 1);

          if (s.waveProgressLambs >= s.waveTargetLambs) {
            s.wave += 1;
            s.waveProgressLambs = 0;
            s.waveTargetLambs += 2;
            s.score += 250 * s.wave;
            s.lantern = Math.min(100, s.lantern + 20);
            soundRef.current?.playWaveClear();
            spawnParticles(s.foldX, s.foldY, 26, '#FBBF24', 180);
          }
        }
      }

      // Update Pickups
      for (let i = s.pickups.length - 1; i >= 0; i--) {
        const pk = s.pickups[i];
        pk.bob += dt * 3;
        if (Math.hypot(pk.x - s.playerX, pk.y - s.playerY) < 30) {
          if (pk.kind === 'oil') {
            s.lantern = Math.min(100, s.lantern + 28);
            s.score += 60 * s.combo;
            spawnParticles(pk.x, pk.y, 14, '#FBBF24', 125);
          } else {
            s.score += 150 * s.combo;
            s.combo = Math.min(5, s.combo + 1);
            s.comboTimer = 6.5;
            s.pulseCooldown = 0;
            spawnParticles(pk.x, pk.y, 14, '#A7F3D0', 125);
          }
          soundRef.current?.playPickup();
          s.pickups.splice(i, 1);
        }
      }

      // Update Shadow Wolves (Stalk -> Windup Telegraph -> Lunge)
      for (const wolf of s.wolves) {
        if (wolf.stunTimer > 0) {
          wolf.stunTimer = Math.max(0, wolf.stunTimer - dt);
          continue;
        }

        // Target nearest wandering/following lamb or player
        let targetX = s.playerX;
        let targetY = s.playerY;
        let minTargetDist = Math.hypot(s.playerX - wolf.x, s.playerY - wolf.y);
        for (const lamb of s.lambs) {
          const ld = Math.hypot(lamb.x - wolf.x, lamb.y - wolf.y);
          if (ld < minTargetDist) {
            minTargetDist = ld;
            targetX = lamb.x;
            targetY = lamb.y;
          }
        }

        if (wolf.lungeTimer > 0) {
          wolf.lungeTimer = Math.max(0, wolf.lungeTimer - dt);
          const dx = wolf.tx - wolf.x;
          const dy = wolf.ty - wolf.y;
          const d = Math.hypot(dx, dy) || 1;
          wolf.x += (dx / d) * wolf.speed * 2.5 * dt;
          wolf.y += (dy / d) * wolf.speed * 2.5 * dt;
        } else if (wolf.windupTimer > 0) {
          wolf.windupTimer = Math.max(0, wolf.windupTimer - dt);
          if (wolf.windupTimer === 0) {
            wolf.lungeTimer = 0.55;
          }
        } else {
          const dx = targetX - wolf.x;
          const dy = targetY - wolf.y;
          const d = Math.hypot(dx, dy) || 1;
          if (d < 165) {
            wolf.windupTimer = 0.52;
            wolf.tx = targetX;
            wolf.ty = targetY;
          } else {
            wolf.x += (dx / d) * wolf.speed * dt;
            wolf.y += (dy / d) * wolf.speed * dt;
          }
        }

        // Player collision
        if (s.playerInvuln <= 0 && Math.hypot(wolf.x - s.playerX, wolf.y - s.playerY) < 26) {
          s.lantern = Math.max(0, s.lantern - 18);
          s.playerInvuln = 1.1;
          s.hitFlash = 1;
          s.shakeMag = 9;
          s.combo = 1;
          wolf.stunTimer = 1.2;
          soundRef.current?.playHurt();
          spawnParticles(s.playerX, s.playerY, 16, '#F87171', 150);
        }
      }

      // Rings
      for (let i = s.rings.length - 1; i >= 0; i--) {
        const ring = s.rings[i];
        ring.radius += 420 * dt;
        ring.alpha = Math.max(0, 1 - ring.radius / ring.maxRadius);
        if (ring.radius >= ring.maxRadius) {
          s.rings.splice(i, 1);
        }
      }

      // Particles
      for (const p of s.particles) {
        if (!p.active) continue;
        p.life -= dt;
        if (p.life <= 0) {
          p.active = false;
          continue;
        }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= 0.94;
        p.vy *= 0.94;
      }

      s.hudSyncAccum += dt;
      if (s.hudSyncAccum >= 0.08) {
        s.hudSyncAccum = 0;
        setHud({
          score: Math.round(s.score),
          wave: s.wave,
          lambsSaved: s.lambsSaved,
          lantern: Math.round(s.lantern),
          combo: s.combo,
          pulseReady: s.pulseCooldown <= 0,
          durationSeconds: Math.round(s.elapsedSeconds),
        });
      }
    };

    const drawFrame = () => {
      const s = simRef.current;
      const w = s.width;
      const h = s.height;

      ctx.save();
      if (s.shakeMag > 0.2) {
        const sx = (Math.random() - 0.5) * s.shakeMag * 2;
        const sy = (Math.random() - 0.5) * s.shakeMag * 2;
        ctx.translate(sx, sy);
      }

      // 60% Dominant Sanctuary Night-Highland Pasture Surface
      const bgGrad = ctx.createRadialGradient(s.foldX, s.foldY, 40, s.foldX, s.foldY, Math.max(w, h) * 0.72);
      bgGrad.addColorStop(0, '#133A27');
      bgGrad.addColorStop(0.55, '#0B2419');
      bgGrad.addColorStop(1, '#06110D');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, w, h);

      // Subtle meadow contour grid lines
      ctx.strokeStyle = 'rgba(226, 194, 139, 0.06)';
      ctx.lineWidth = 1;
      for (let gx = 0; gx < w; gx += 72) {
        ctx.beginPath();
        ctx.moveTo(gx, 0);
        ctx.lineTo(gx, h);
        ctx.stroke();
      }
      for (let gy = 0; gy < h; gy += 72) {
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.lineTo(w, gy);
        ctx.stroke();
      }

      // Central Sanctuary Stone Fold
      const foldGlow = ctx.createRadialGradient(s.foldX, s.foldY, 10, s.foldX, s.foldY, s.foldRadius * 1.9);
      foldGlow.addColorStop(0, 'rgba(226, 194, 139, 0.30)');
      foldGlow.addColorStop(1, 'rgba(226, 194, 139, 0)');
      ctx.fillStyle = foldGlow;
      ctx.beginPath();
      ctx.arc(s.foldX, s.foldY, s.foldRadius * 1.9, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#1D2922';
      ctx.strokeStyle = '#D4A55D';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(s.foldX, s.foldY, s.foldRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#E2C28B';
      ctx.font = '600 11px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('SANCTUARY FOLD', s.foldX, s.foldY + 4);

      // Beacon Pulse Rings
      for (const ring of s.rings) {
        ctx.strokeStyle = `rgba(251, 191, 36, ${ring.alpha * 0.85})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(ring.x, ring.y, ring.radius, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Pickups
      for (const pk of s.pickups) {
        const yOff = Math.sin(pk.bob) * 4;
        if (pk.kind === 'oil') {
          ctx.fillStyle = '#F59E0B';
          ctx.beginPath();
          ctx.arc(pk.x, pk.y + yOff, 10, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#FEF3C7';
          ctx.lineWidth = 2;
          ctx.stroke();
        } else {
          ctx.fillStyle = '#10B981';
          ctx.fillRect(pk.x - 9, pk.y + yOff - 11, 18, 22);
          ctx.strokeStyle = '#ECFDF5';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(pk.x - 9, pk.y + yOff - 11, 18, 22);
        }
      }

      // Stray Lambs
      for (const lamb of s.lambs) {
        const hop = Math.abs(Math.sin(lamb.wobble)) * 3;
        ctx.fillStyle = lamb.state === 'following' ? '#FEF3C7' : '#F8FAFC';
        ctx.beginPath();
        ctx.arc(lamb.x, lamb.y - hop, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = lamb.state === 'following' ? '#F59E0B' : '#94A3B8';
        ctx.lineWidth = 2;
        ctx.stroke();
        // Little ears
        ctx.fillStyle = '#334155';
        ctx.beginPath();
        ctx.arc(lamb.x + 6, lamb.y - hop - 2, 3, 0, Math.PI * 2);
        ctx.fill();
      }

      // Shadow Wolves & Windup Telegraph Lines
      for (const wolf of s.wolves) {
        if (wolf.windupTimer > 0) {
          ctx.strokeStyle = 'rgba(248, 113, 113, 0.7)';
          ctx.setLineDash([5, 5]);
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(wolf.x, wolf.y);
          ctx.lineTo(wolf.tx, wolf.ty);
          ctx.stroke();
          ctx.setLineDash([]);

          ctx.fillStyle = '#FCA5A5';
          ctx.font = 'bold 14px ui-monospace, monospace';
          ctx.textAlign = 'center';
          ctx.fillText('!', wolf.x, wolf.y - 20);
        }

        ctx.fillStyle = wolf.stunTimer > 0 ? '#78716C' : '#3F1D28';
        ctx.strokeStyle = wolf.stunTimer > 0 ? '#D6D3D1' : '#EF4444';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(wolf.x, wolf.y - 14);
        ctx.lineTo(wolf.x + 13, wolf.y + 11);
        ctx.lineTo(wolf.x - 13, wolf.y + 11);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }

      // Player Shepherd + Lantern Radiance
      const lightRadius = 85 + (s.lantern / 100) * 115;
      const lanternAura = ctx.createRadialGradient(s.playerX, s.playerY, 8, s.playerX, s.playerY, lightRadius);
      lanternAura.addColorStop(0, 'rgba(251, 191, 36, 0.35)');
      lanternAura.addColorStop(0.55, 'rgba(217, 119, 6, 0.12)');
      lanternAura.addColorStop(1, 'rgba(217, 119, 6, 0)');
      ctx.fillStyle = lanternAura;
      ctx.beginPath();
      ctx.arc(s.playerX, s.playerY, lightRadius, 0, Math.PI * 2);
      ctx.fill();

      const blinkHide = s.playerInvuln > 0 && Math.floor(s.playerInvuln * 14) % 2 === 0;
      if (!blinkHide) {
        ctx.fillStyle = s.hitFlash > 0 ? '#FCA5A5' : '#FBBF24';
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(s.playerX, s.playerY, 15, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }

      // Particles
      for (const p of s.particles) {
        if (!p.active) continue;
        const alpha = Math.max(0, p.life / p.maxLife);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.restore();
    };

    const loop = (now: number) => {
      const rawDt = (now - lastTs) / 1000;
      lastTs = now;
      const dt = Math.min(rawDt, 0.05);

      if (stateRef.current === 'PLAYING') {
        stepSimulation(dt);
      }
      drawFrame();
      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resizeCanvas);
    };
  }, [persistGameScore, spawnParticles]);

  const handleCanvasPointer = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (stateRef.current !== 'PLAYING') return;
    const rect = e.currentTarget.getBoundingClientRect();
    simRef.current.pointerX = e.clientX - rect.left;
    simRef.current.pointerY = e.clientY - rect.top;
    simRef.current.pointerActive = true;
  };

  const lightStatusLabel =
    hud.lantern > 60 ? 'RADIANT' : hud.lantern > 28 ? 'STEADY' : 'LOW LIGHT';

  return (
    <div className="relative w-screen h-[100dvh] overflow-hidden bg-[#06110D] text-stone-100 select-none">
      {/* Isolated Full-Viewport 2D Game Canvas */}
      <canvas
        ref={canvasRef}
        onPointerDown={(e) => {
          handleCanvasPointer(e);
          if (e.button === 0) triggerBeaconPulse();
        }}
        onPointerMove={(e) => {
          if (e.buttons > 0 || e.pointerType === 'touch') {
            handleCanvasPointer(e);
          }
        }}
        onPointerUp={() => {
          simRef.current.pointerActive = false;
        }}
        onPointerCancel={() => {
          simRef.current.pointerActive = false;
        }}
        className="block w-full h-full touch-none cursor-crosshair"
      />

      {/* Active Play / Pause Unobtrusive Top HUD */}
      {gameState !== 'TITLE_MENU' && (
        <div className="pointer-events-none absolute top-0 inset-x-0 p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3 z-20">
          <div className="flex flex-wrap items-center gap-3 sm:gap-5 bg-[#0A1611]/85 backdrop-blur-sm border border-stone-700/80 px-4 py-2 text-xs">
            <div>
              <span className="text-stone-400 block text-[10px] uppercase tracking-wider">Score</span>
              <span className="font-mono tabular-nums text-base font-semibold text-[#FBBF24]">
                {hud.score.toLocaleString()}
              </span>
            </div>
            <div className="border-l border-stone-700 pl-3">
              <span className="text-stone-400 block text-[10px] uppercase tracking-wider">Wave</span>
              <span className="font-mono tabular-nums text-base font-semibold text-white">
                {hud.wave}
              </span>
            </div>
            <div className="border-l border-stone-700 pl-3">
              <span className="text-stone-400 block text-[10px] uppercase tracking-wider">Lambs Folded</span>
              <span className="font-mono tabular-nums text-base font-semibold text-emerald-300">
                {hud.lambsSaved}
              </span>
            </div>
            <div className="border-l border-stone-700 pl-3 min-w-[130px]">
              <div className="flex items-center justify-between text-[10px] font-mono mb-1">
                <span className="text-stone-300">{lightStatusLabel}</span>
                <span className="tabular-nums text-[#E2C28B]">{hud.lantern}%</span>
              </div>
              <div className="w-full h-1.5 bg-stone-800 overflow-hidden">
                <div
                  className={`h-full transition-all duration-150 ${
                    hud.lantern > 28 ? 'bg-[#FBBF24]' : 'bg-red-500'
                  }`}
                  style={{ width: `${hud.lantern}%` }}
                />
              </div>
            </div>
            <div className="hidden sm:block border-l border-stone-700 pl-3 text-[11px] font-mono tabular-nums text-stone-300">
              <span>x{hud.combo} Combo</span>
              <span className="mx-1.5" aria-hidden="true">·</span>
              <span>{hud.pulseReady ? 'Pulse Ready [Space]' : 'Recharging Pulse'}</span>
            </div>
          </div>

          <div className="pointer-events-auto flex items-center gap-2">
            <button
              type="button"
              onClick={triggerBeaconPulse}
              disabled={!hud.pulseReady || gameState !== 'PLAYING'}
              className="px-3 py-2 bg-[#B4823E] hover:bg-[#9A6B2F] disabled:opacity-45 text-white text-xs font-semibold cursor-pointer"
            >
              Beacon Pulse
            </button>
            <button
              type="button"
              onClick={() => setMuted((m) => !m)}
              aria-label={muted ? 'Unmute sound' : 'Mute sound'}
              className="h-9 w-9 flex items-center justify-center bg-[#0A1611]/90 border border-stone-700 text-stone-200 hover:text-white cursor-pointer"
            >
              {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={togglePause}
              aria-label="Pause game"
              className="h-9 w-9 flex items-center justify-center bg-[#0A1611]/90 border border-stone-700 text-stone-200 hover:text-white cursor-pointer"
            >
              <Pause className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* TITLE SCREEN OVERLAY */}
      {gameState === 'TITLE_MENU' && (
        <div className="absolute inset-0 z-30 flex flex-col justify-between">
          <img
            src={backdropImg}
            alt="Kisii Highland Sanctuary hills at twilight with a glowing shepherd lantern"
            referrerPolicy="no-referrer"
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#07110D]/92 via-[#07110D]/68 to-[#07110D]/30" />

          {/* Top Escape Hatch & Audio Toggle */}
          <div className="relative z-10 p-6 sm:p-8 flex items-center justify-between">
            <button
              type="button"
              onClick={onBackToSite}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#0A1611]/85 border border-white/20 text-xs font-semibold text-white hover:bg-black/80 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to GVCC Site</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowLeaderboardModal((v) => !v)}
                className="inline-flex items-center gap-2 px-3.5 py-2 bg-[#0A1611]/85 border border-white/20 text-xs font-semibold text-[#E2C28B] hover:bg-black/80 cursor-pointer"
              >
                <Trophy className="w-4 h-4" />
                <span>Leaderboard ({leaderboard.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setMuted((m) => !m)}
                aria-label={muted ? 'Unmute audio' : 'Mute audio'}
                className="h-9 w-9 flex items-center justify-center bg-[#0A1611]/85 border border-white/20 text-white hover:bg-black/80 cursor-pointer"
              >
                {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Left-Anchored Title Lockup + Start CTA */}
          <div className="relative z-10 max-w-6xl w-full mx-auto px-6 sm:px-10 pb-12 sm:pb-16 grid grid-cols-1 lg:grid-cols-12 gap-8 items-end">
            <div className="lg:col-span-7 space-y-5">
              {/* Bespoke SVG Emblem */}
              <div className="flex items-center gap-3">
                <svg
                  width="44"
                  height="44"
                  viewBox="0 0 44 44"
                  fill="none"
                  aria-hidden="true"
                >
                  <rect x="2" y="2" width="40" height="40" stroke="#E2C28B" strokeWidth="1.5" fill="rgba(18,22,19,0.8)" />
                  <path d="M22 10V34M16 18H28" stroke="#FBBF24" strokeWidth="2.2" strokeLinecap="round" />
                  <circle cx="22" cy="18" r="9" stroke="#E2C28B" strokeWidth="1.2" strokeDasharray="3 3" />
                </svg>
                <span className="text-xs uppercase tracking-[0.2em] text-[#E2C28B] font-semibold">
                  GVCC Fellowship Arcade · Ogembo Sanctuary
                </span>
              </div>

              <h1 className="font-serif text-4xl sm:text-6xl font-medium text-white tracking-tight leading-none">
                Shepherd&apos;s Light
              </h1>

              <p className="text-sm sm:text-base text-stone-200 max-w-xl leading-relaxed">
                Carry the golden lantern across the highland pasture at twilight. Guide wandering lambs into the Sanctuary Fold, gather olive oil flasks to sustain your flame, and pulse your Beacon Light to scatter stalking shadows.
              </p>

              <div className="flex flex-wrap items-center gap-4 pt-2">
                <button
                  type="button"
                  onClick={startGame}
                  className="inline-flex items-center gap-2.5 px-7 py-3.5 bg-[#B4823E] hover:bg-[#9A6B2F] text-white text-sm font-semibold transition-colors cursor-pointer"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>Start Game</span>
                </button>

                {firebaseUser ? (
                  <div className="px-4 py-2.5 bg-[#0A1611]/85 border border-white/20 text-xs">
                    <span className="text-stone-300">Signed in: </span>
                    <strong className="text-white">
                      {firestoreProfile?.displayName || firebaseUser.displayName}
                    </strong>
                    <span className="mx-2 text-stone-500">·</span>
                    <span className="font-mono tabular-nums text-[#E2C28B]">
                      Best {firestoreProfile?.bestScore ?? 0}
                    </span>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => signInWithGoogle()}
                    className="inline-flex items-center gap-2 px-4 py-3.5 bg-[#0A1611]/85 border border-white/25 hover:bg-black/80 text-white text-xs font-semibold cursor-pointer"
                  >
                    <LogIn className="w-4 h-4" />
                    <span>Sign In with Google to Save High Scores</span>
                  </button>
                )}
              </div>

              <p className="text-xs font-mono text-stone-300 pt-1">
                Move: WASD / Arrows or Drag · Beacon Pulse: Space / Click · Pause: Esc
              </p>
            </div>

            {showLeaderboardModal && (
              <div className="lg:col-span-5 bg-[#0A1611]/92 border border-stone-700 p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-stone-800 pb-3">
                  <h2 className="font-serif text-xl text-white">Sanctuary Top Shepherds</h2>
                  <span className="text-xs font-mono text-[#E2C28B]">Cloud Firestore</span>
                </div>
                {leaderboard.length === 0 ? (
                  <p className="text-xs text-stone-300">
                    No saved runs yet. Sign in with Google and complete a run to appear on the Sanctuary leaderboard.
                  </p>
                ) : (
                  <ul className="space-y-2 max-h-56 overflow-y-auto">
                    {leaderboard.map((entry, idx) => (
                      <li
                        key={entry.id}
                        className="flex items-center justify-between text-xs border-b border-stone-800/80 pb-2"
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="font-mono tabular-nums text-[#E2C28B] w-5">
                            {idx + 1}.
                          </span>
                          <span className="font-medium text-white truncate max-w-[150px]">
                            {entry.displayName}
                          </span>
                        </div>
                        <div className="font-mono tabular-nums text-stone-300">
                          <span className="text-white font-semibold">{entry.bestScore}</span>
                          <span className="text-stone-500 ml-2">W{entry.bestWave}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* PAUSE MODAL */}
      {gameState === 'PAUSED' && (
        <div className="absolute inset-0 z-30 bg-black/75 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-[#121614] border border-stone-700 p-8 max-w-md w-full text-center space-y-6">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-[#E2C28B] font-semibold">
                Game Paused
              </p>
              <h2 className="font-serif text-3xl text-white mt-1">Shepherd&apos;s Light</h2>
            </div>
            <div className="grid grid-cols-3 gap-3 border-y border-stone-800 py-4 text-xs">
              <div>
                <span className="text-stone-400 block">Score</span>
                <span className="font-mono tabular-nums text-lg text-[#FBBF24]">{hud.score}</span>
              </div>
              <div>
                <span className="text-stone-400 block">Wave</span>
                <span className="font-mono tabular-nums text-lg text-white">{hud.wave}</span>
              </div>
              <div>
                <span className="text-stone-400 block">Lambs</span>
                <span className="font-mono tabular-nums text-lg text-emerald-300">{hud.lambsSaved}</span>
              </div>
            </div>
            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={togglePause}
                className="w-full py-3 bg-[#B4823E] hover:bg-[#9A6B2F] text-white text-xs font-semibold cursor-pointer"
              >
                Resume Game
              </button>
              <button
                type="button"
                onClick={startGame}
                className="w-full py-2.5 border border-stone-600 text-stone-200 hover:text-white text-xs font-semibold cursor-pointer"
              >
                Restart Run
              </button>
              <button
                type="button"
                onClick={onBackToSite}
                className="w-full py-2.5 text-stone-400 hover:text-white text-xs cursor-pointer"
              >
                Exit to GVCC Website
              </button>
            </div>
          </div>
        </div>
      )}

      {/* GAME OVER MODAL */}
      {gameState === 'GAME_OVER' && (
        <div className="absolute inset-0 z-30 bg-black/80 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-[#121614] border border-stone-700 p-7 sm:p-9 max-w-lg w-full space-y-6">
            <div className="text-center space-y-2">
              <p className="text-xs uppercase tracking-[0.18em] text-[#E2C28B] font-semibold">
                Night Watch Complete
              </p>
              <h2 className="font-serif text-3xl text-white">Lantern Flame Spent</h2>
              <p className="text-xs text-stone-300">
                Every lamb guided to the Sanctuary Fold stands safe through the night.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-4 border-y border-stone-800 py-4 text-center">
              <div>
                <span className="text-[11px] uppercase tracking-wider text-stone-400 block">
                  Final Score
                </span>
                <span className="font-mono tabular-nums text-2xl font-semibold text-[#FBBF24]">
                  {hud.score}
                </span>
              </div>
              <div>
                <span className="text-[11px] uppercase tracking-wider text-stone-400 block">
                  Wave Reached
                </span>
                <span className="font-mono tabular-nums text-2xl font-semibold text-white">
                  {hud.wave}
                </span>
              </div>
              <div>
                <span className="text-[11px] uppercase tracking-wider text-stone-400 block">
                  Lambs Sheltered
                </span>
                <span className="font-mono tabular-nums text-2xl font-semibold text-emerald-300">
                  {hud.lambsSaved}
                </span>
              </div>
            </div>

            {firebaseUser ? (
              <div className="text-xs bg-[#0B1410] border border-stone-800 p-3.5 text-center">
                {saveStatus === 'saving' && (
                  <span className="text-[#E2C28B]">Syncing run to Firestore leaderboard...</span>
                )}
                {saveStatus === 'saved' && (
                  <span className="text-emerald-300">{saveMessage}</span>
                )}
                {saveStatus === 'error' && (
                  <span className="text-red-300">{saveMessage}</span>
                )}
              </div>
            ) : (
              <div className="bg-[#0B1410] border border-stone-800 p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
                <p className="text-xs text-stone-300">
                  Sign in with Google to save this score to the Sanctuary Leaderboard.
                </p>
                <button
                  type="button"
                  onClick={() => signInWithGoogle().then(() => persistGameScore(hud)).catch(() => {})}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#1C1917] border border-stone-600 text-white text-xs font-semibold shrink-0 cursor-pointer"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Sign In &amp; Save</span>
                </button>
              </div>
            )}

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={startGame}
                className="flex-1 inline-flex items-center justify-center gap-2 py-3 px-4 bg-[#B4823E] hover:bg-[#9A6B2F] text-white text-xs font-semibold whitespace-nowrap cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Play Again</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  stateRef.current = 'TITLE_MENU';
                  setGameState('TITLE_MENU');
                }}
                className="py-3 px-4 border border-stone-600 text-stone-200 hover:text-white text-xs font-semibold whitespace-nowrap cursor-pointer"
              >
                Title Menu
              </button>
              <button
                type="button"
                onClick={onBackToSite}
                className="py-3 px-4 border border-stone-700 text-stone-300 hover:text-white text-xs font-semibold whitespace-nowrap cursor-pointer"
              >
                GVCC Site
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
