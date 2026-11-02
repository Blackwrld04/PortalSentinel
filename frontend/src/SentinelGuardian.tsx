import React, { useState, useEffect, useRef } from "react";

interface SentinelGuardianProps {
  simStep?: number;
  isSimulating?: boolean;
  onTriggerDefense?: () => void;
  size?: number;
}

export const SentinelGuardian: React.FC<SentinelGuardianProps> = ({
  simStep = 0,
  isSimulating = false,
  onTriggerDefense,
  size = 280,
}) => {
  const [isBlinking, setIsBlinking] = useState(false);
  const [eyeOffset, setEyeOffset] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Autonomous Blinking Loop
  useEffect(() => {
    let blinkTimeout: NodeJS.Timeout;

    const triggerBlink = () => {
      setIsBlinking(true);
      setTimeout(() => {
        setIsBlinking(false);
        // 25% chance for a quick double-blink
        if (Math.random() < 0.25) {
          setTimeout(() => {
            setIsBlinking(true);
            setTimeout(() => setIsBlinking(false), 120);
          }, 140);
        }
      }, 130);

      // Next blink in 2.8 to 5.2 seconds
      const nextDelay = isSimulating ? 1500 : 2800 + Math.random() * 2400;
      blinkTimeout = setTimeout(triggerBlink, nextDelay);
    };

    blinkTimeout = setTimeout(triggerBlink, 3000);
    return () => clearTimeout(blinkTimeout);
  }, [isSimulating]);

  // Idle Eye Patrol Movement (when mouse is not actively over it)
  useEffect(() => {
    if (isHovered) return;

    const patrolInterval = setInterval(() => {
      // Natural roving eye scan angles
      const angles = [
        { x: 0, y: 0 },
        { x: -5, y: -2 },
        { x: 5, y: -1 },
        { x: -3, y: 3 },
        { x: 4, y: 2 },
        { x: 0, y: -3 },
      ];
      const nextPos = angles[Math.floor(Math.random() * angles.length)];
      setEyeOffset(nextPos);
    }, 2200);

    return () => clearInterval(patrolInterval);
  }, [isHovered]);

  // Interactive Mouse Look-Around Tracking
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const deltaX = (e.clientX - centerX) / (rect.width / 2);
    const deltaY = (e.clientY - centerY) / (rect.height / 2);

    // Limit eye look range to max ±9px
    setEyeOffset({
      x: Math.max(-9, Math.min(9, deltaX * 9)),
      y: Math.max(-7, Math.min(7, deltaY * 7)),
    });
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setEyeOffset({ x: 0, y: 0 });
  };

  // State-driven styling
  const isAlarm = isSimulating && (simStep === 1 || simStep === 2);
  const isDispatched = isSimulating && (simStep === 3 || simStep === 4);
  const isSuccess = simStep === 5;

  const eyeColor = isAlarm 
    ? "#ff3b1e" 
    : isDispatched 
    ? "#ff9b4d" 
    : isSuccess 
    ? "#78e9c4" 
    : "#ff6a1a";

  const glowColor = isAlarm 
    ? "rgba(255, 59, 30, 0.7)" 
    : isSuccess 
    ? "rgba(120, 233, 196, 0.6)" 
    : "rgba(255, 106, 26, 0.5)";

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={handleMouseLeave}
      onClick={onTriggerDefense}
      title="PortalSentinel Autonomous Guardian Eye (Click to test defense)"
      className="relative flex items-center justify-center cursor-pointer select-none transition-transform duration-300"
      style={{
        width: `${size}px`,
        height: `${size}px`,
      }}
    >
      {/* Floating & Breathing Animation Container */}
      <div 
        className="relative w-full h-full flex items-center justify-center"
        style={{
          animation: "sentinel-float 4.5s ease-in-out infinite",
        }}
      >
        <svg
          viewBox="0 0 240 240"
          className="w-full h-full overflow-visible"
        >
          <defs>
            {/* Outer Aura Glow */}
            <filter id="sentinelGlow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="7" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>

            {/* Eye Intense Glow */}
            <filter id="eyeGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="5" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>

            {/* Sphere Metallic Shading */}
            <radialGradient id="sphereGrad" cx="35%" cy="30%" r="70%">
              <stop offset="0%" stopColor="#28221c" />
              <stop offset="45%" stopColor="#14110e" />
              <stop offset="85%" stopColor="#080706" />
              <stop offset="100%" stopColor="#030202" />
            </radialGradient>

            {/* Sphere Rim Light Gradient */}
            <linearGradient id="rimGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={eyeColor} stopOpacity="0.8" />
              <stop offset="40%" stopColor="#403225" stopOpacity="0.3" />
              <stop offset="80%" stopColor="#17110b" stopOpacity="0.1" />
              <stop offset="100%" stopColor={eyeColor} stopOpacity="0.6" />
            </linearGradient>

            {/* Eye Gradient */}
            <radialGradient id="eyeGradient" cx="40%" cy="35%" r="65%">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="35%" stopColor="#ffc58a" />
              <stop offset="70%" stopColor={eyeColor} />
              <stop offset="100%" stopColor={isAlarm ? "#b81400" : "#a83e05"} />
            </radialGradient>
          </defs>

          {/* 1. Orbit Ring A (Clockwise Slow Rotation) */}
          <g
            style={{
              transformOrigin: "120px 120px",
              animation: "sentinel-orbit-cw 28s linear infinite",
            }}
          >
            <circle
              cx="120"
              cy="120"
              r="110"
              fill="none"
              stroke="#38291e"
              strokeWidth="1.2"
              strokeDasharray="6 14 2 14"
              opacity="0.75"
            />
            {/* Orbit tick mark */}
            <circle cx="120" cy="10" r="3" fill={eyeColor} filter="url(#eyeGlow)" />
            <circle cx="120" cy="230" r="2.5" fill="#594230" />
          </g>

          {/* 2. Orbit Ring B (Counter-Clockwise Rotation) */}
          <g
            style={{
              transformOrigin: "120px 120px",
              animation: "sentinel-orbit-ccw 20s linear infinite",
            }}
          >
            <circle
              cx="120"
              cy="120"
              r="96"
              fill="none"
              stroke={isAlarm ? "#ff3b1e" : "#ff6a1a"}
              strokeWidth="0.8"
              strokeDasharray="40 120"
              opacity={isAlarm ? "0.9" : "0.5"}
            />
            {/* Tech Corner Crosshairs */}
            <line x1="24" y1="120" x2="30" y2="120" stroke="#ff8638" strokeWidth="1.5" />
            <line x1="210" y1="120" x2="216" y2="120" stroke="#ff8638" strokeWidth="1.5" />
            <line x1="120" y1="24" x2="120" y2="30" stroke="#ff8638" strokeWidth="1.5" />
            <line x1="120" y1="210" x2="120" y2="216" stroke="#ff8638" strokeWidth="1.5" />
          </g>

          {/* 3. Outer Halo Glow Ring */}
          <circle
            cx="120"
            cy="120"
            r="82"
            fill="none"
            stroke={eyeColor}
            strokeWidth="1.5"
            opacity={isAlarm ? "0.85" : "0.35"}
            filter="url(#sentinelGlow)"
          />

          {/* 4. Guardian Sphere Chassis Body */}
          <circle
            cx="120"
            cy="120"
            r="78"
            fill="url(#sphereGrad)"
            stroke="url(#rimGrad)"
            strokeWidth="2.2"
          />

          {/* 5. Inner Visor Plate Arch */}
          <path
            d="M 58 120 C 58 84 84 58 120 58 C 156 58 182 84 182 120 C 182 135 174 148 160 156 C 148 162 92 162 80 156 C 66 148 58 135 58 120 Z"
            fill="#090807"
            stroke="#2e2219"
            strokeWidth="1"
          />

          {/* 6. Subtle High-Tech Visor Grid Lines */}
          <line x1="72" y1="120" x2="168" y2="120" stroke="#261b14" strokeWidth="0.75" strokeDasharray="3 3" />
          <line x1="120" y1="80" x2="120" y2="150" stroke="#261b14" strokeWidth="0.75" strokeDasharray="3 3" />

          {/* 7. THE TWO SENTINEL EYES (••) */}
          <g
            style={{
              transform: `translate(${eyeOffset.x}px, ${eyeOffset.y}px)`,
              transition: isHovered ? "transform 0.08s ease-out" : "transform 0.4s ease-out",
            }}
          >
            {/* LEFT EYE */}
            <g
              style={{
                transformOrigin: "94px 118px",
                transform: isBlinking ? "scaleY(0.08)" : "scaleY(1)",
                transition: "transform 0.08s ease-in-out",
              }}
            >
              {/* Eye Glow Aura */}
              <circle
                cx="94"
                cy="118"
                r="17"
                fill={eyeColor}
                opacity="0.3"
                filter="url(#sentinelGlow)"
              />
              {/* Outer Iris */}
              <circle
                cx="94"
                cy="118"
                r="13.5"
                fill="url(#eyeGradient)"
                filter="url(#eyeGlow)"
              />
              {/* Inner Core Pupil */}
              <circle
                cx="93"
                cy="116.5"
                r="4.5"
                fill="#ffffff"
                opacity="0.9"
              />
              {/* Lens Glint */}
              <circle cx="96" cy="114" r="1.8" fill="#ffffff" opacity="0.95" />
            </g>

            {/* RIGHT EYE */}
            <g
              style={{
                transformOrigin: "146px 118px",
                transform: isBlinking ? "scaleY(0.08)" : "scaleY(1)",
                transition: "transform 0.08s ease-in-out",
              }}
            >
              {/* Eye Glow Aura */}
              <circle
                cx="146"
                cy="118"
                r="17"
                fill={eyeColor}
                opacity="0.3"
                filter="url(#sentinelGlow)"
              />
              {/* Outer Iris */}
              <circle
                cx="146"
                cy="118"
                r="13.5"
                fill="url(#eyeGradient)"
                filter="url(#eyeGlow)"
              />
              {/* Inner Core Pupil */}
              <circle
                cx="145"
                cy="116.5"
                r="4.5"
                fill="#ffffff"
                opacity="0.9"
              />
              {/* Lens Glint */}
              <circle cx="148" cy="114" r="1.8" fill="#ffffff" opacity="0.95" />
            </g>
          </g>

          {/* 8. Forehead Sensor Core */}
          <polygon
            points="120,70 125,78 120,86 115,78"
            fill={eyeColor}
            opacity={isAlarm ? "1" : "0.75"}
            filter="url(#eyeGlow)"
          />

          {/* 9. Chin Security Status Indicator */}
          <g transform="translate(120, 168)">
            <rect
              x="-18"
              y="-3"
              width="36"
              height="6"
              rx="3"
              fill="#140f0c"
              stroke="#38291e"
              strokeWidth="0.8"
            />
            <circle
              cx={isAlarm ? "-8" : isSuccess ? "8" : "0"}
              cy="0"
              r="2"
              fill={eyeColor}
              filter="url(#eyeGlow)"
            />
          </g>
        </svg>

        {/* Ambient Ground Shadow Below Floating Guardian */}
        <div 
          className="absolute -bottom-4 w-36 h-4 rounded-[50%] blur-md pointer-events-none transition-all duration-300"
          style={{
            background: `radial-gradient(ellipse at center, ${glowColor} 0%, rgba(0,0,0,0) 70%)`,
            opacity: isHovered ? 0.9 : 0.6,
          }}
        />

        {/* Floating Telemetry Tag Badge */}
        <div 
          className="absolute -bottom-7 mono text-[9px] px-2.5 py-1 bg-[#0b0a08]/90 border border-[#38291e] rounded text-[#dfbc97] whitespace-nowrap pointer-events-none shadow-lg flex items-center gap-1.5"
        >
          <span 
            className="w-1.5 h-1.5 rounded-full"
            style={{
              backgroundColor: eyeColor,
              boxShadow: `0 0 6px ${eyeColor}`,
            }}
          />
          <span>
            {isAlarm 
              ? "STATUS: THREAT DETECTED" 
              : isDispatched 
              ? "STATUS: FRONT-RUNNING DRAIN" 
              : isSuccess 
              ? "STATUS: CAPITAL SECURED" 
              : "STATUS: SCANNING BLOCKS"}
          </span>
        </div>
      </div>
    </div>
  );
};
