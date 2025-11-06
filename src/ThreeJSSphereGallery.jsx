import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';

const TiltedCard = ({ imageSrc, altText, onClose }) => {
  const cardRef = useRef(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (isMobile || !cardRef.current) return;
    const card = cardRef.current;
    let animationFrameId;

    const handleMouseMove = (e) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const rotateX = ((y - centerY) / centerY) * 12;
      const rotateY = ((centerX - x) / centerX) * 12;
      animationFrameId = requestAnimationFrame(() => {
        card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.05)`;
      });
    };

    const handleMouseLeave = () => {
      animationFrameId = requestAnimationFrame(() => {
        card.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale(1)';
      });
    };

    card.addEventListener('mousemove', handleMouseMove);
    card.addEventListener('mouseleave', handleMouseLeave);
    return () => {
      card.removeEventListener('mousemove', handleMouseMove);
      card.removeEventListener('mouseleave', handleMouseLeave);
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };
  }, [isMobile]);

  // Responsive dimensions based on device
  const cardHeight = isMobile ? '70vh' : '500px';
  const cardWidth = isMobile ? '90vw' : '400px';

  return (
    <div className="relative flex items-center justify-center">
      <div 
        ref={cardRef} 
        style={{ 
          height: cardHeight, 
          width: cardWidth, 
          transition: 'transform 0.1s ease-out', 
          transformStyle: 'preserve-3d',
          maxHeight: isMobile ? '70vh' : 'none',
          maxWidth: isMobile ? '90vw' : 'none'
        }} 
        className="relative rounded-lg shadow-2xl overflow-hidden"
      >
        <img 
          src={imageSrc} 
          alt={altText} 
          style={{ 
            height: cardHeight, 
            width: cardWidth,
            objectFit: 'cover'
          }} 
          className="w-full h-full" 
        />
      </div>
    </div>
  );
};

const TARGET_IMAGE_COUNT = 250;
const ACTUAL_IMAGE_COUNT = 150;

const baseProjects = Array.from({ length: ACTUAL_IMAGE_COUNT }, (_, i) => ({ id: i + 1, title: `Project ${i + 1}`, image: `/images/${i + 1}.JPG` }));
const mockProjects = Array.from({ length: TARGET_IMAGE_COUNT }, (_, i) => {
  const baseIndex = i % ACTUAL_IMAGE_COUNT;
  const baseProject = baseProjects[baseIndex];
  const repeatCount = Math.floor(i / ACTUAL_IMAGE_COUNT);
  return { id: i + 1, title: `${baseProject.title}${repeatCount > 0 ? ` (${repeatCount + 1})` : ''}`, image: baseProject.image };
});

const ThreeJSSphereGallery = () => {
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const meshesRef = useRef([]);
  const rotationRef = useRef({ x: 0, y: 0 });
  const targetRotationRef = useRef({ x: 0, y: 0 });
  const velocityRef = useRef({ x: 0, y: 0 });
  const isDraggingRef = useRef(false);
  const isManualDraggingRef = useRef(false);
  const mouseRef = useRef({ x: 0, y: 0 });
  const dragStartRef = useRef({ x: 0, y: 0 });
  const autoRotationRef = useRef(0);
  const clickStartPosRef = useRef({ x: 0, y: 0 });
  const manualRotationOffsetRef = useRef({ x: 0, y: 0 });
  const lastClickTimeRef = useRef(0);
  const isNavigatingRef = useRef(false);
  const navigationStartRef = useRef({ x: 0, y: 0 });
  const [isInside, setIsInside] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const initialAnimationRef = useRef(true);
  
  // Function to detect if device is mobile or tablet
  const isMobileOrTablet = () => {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  };
  
  // Get appropriate sensitivity based on device type
  const getTouchSensitivity = (isHorizontal = false) => {
    const isMobile = isMobileOrTablet();
    if (isInside) {
      // Inside globe - very low sensitivity for precision
      return isHorizontal ? (isMobile ? 0.0002 : 0.0003) : (isMobile ? 0.00005 : 0.0001);
    } else {
      // Outside globe - slightly higher but still controlled
      return isHorizontal ? (isMobile ? 0.00015 : 0.00025) : (isMobile ? 0.00003 : 0.00008);
    }
  };

  const initScene = useCallback(() => {
    if (!mountRef.current) return;

    if (sceneRef.current) {
      while (sceneRef.current.children.length > 0) {
        const child = sceneRef.current.children[0];
        sceneRef.current.remove(child);
        if (child instanceof THREE.Mesh) {
          if (child.geometry) child.geometry.dispose();
          if (child.material) {
            if (child.material.map) child.material.map.dispose();
            child.material.dispose();
          }
        }
      }
    }

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(isInside ? 0xe8e8e8 : 0xf5f5f5);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(isInside ? 100 : 75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = isInside ? 0 : 15;
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    rendererRef.current = renderer;

    if (mountRef.current) {
      mountRef.current.innerHTML = '';
      mountRef.current.appendChild(renderer.domElement);
    }

    const radius = 5;
    const textureLoader = new THREE.TextureLoader();
    let loadedCount = 0;
    const totalImages = mockProjects.length;

    const pulseAnimation = () => {
      const time = Date.now() * 0.001;
      const scale = 1 + Math.sin(time * 0.5) * 0.02;
      if (sceneRef.current && !isInside) sceneRef.current.scale.set(scale, scale, scale);
    };

    const goldenAngle = Math.PI * (3 - Math.sqrt(5));
    const averageDistance = (2 * Math.PI * radius) / Math.sqrt(totalImages);
    const optimalWidth = averageDistance * 0.70;
    const optimalBaseSize = optimalWidth;
    
    const createFallbackTexture = (project, x, y, z, adjustedImageSize, scene) => {
      const canvas = document.createElement('canvas');
      canvas.width = 128;
      canvas.height = 128 * 1.4;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
        gradient.addColorStop(0, '#6366f1');
        gradient.addColorStop(1, '#8b5cf6');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 60px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('📷', canvas.width/2, canvas.height/2 - 10);
        ctx.font = 'bold 20px Arial';
        ctx.fillText(`#${project.id}`, canvas.width/2, canvas.height/2 + 40);
        ctx.font = '14px Arial';
        ctx.fillText(project.title, canvas.width/2, canvas.height - 20);
        ctx.font = '12px Arial';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.fillText('Image Unavailable', canvas.width/2, 20);
        const placeholderTexture = new THREE.CanvasTexture(canvas);
        placeholderTexture.minFilter = THREE.LinearFilter;
        placeholderTexture.magFilter = THREE.LinearFilter;
        const material = new THREE.MeshBasicMaterial({ map: placeholderTexture, side: THREE.DoubleSide, transparent: true, opacity: 0.9 });
        const geometry = new THREE.PlaneGeometry(adjustedImageSize, adjustedImageSize * 1.4);
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(x, y, z);
        const upVector = new THREE.Vector3(0, 1, 0);
        if (Math.abs(y) > radius * 0.95) upVector.set(0, 0, 1);
        const matrix = new THREE.Matrix4();
        matrix.lookAt(new THREE.Vector3(x, y, z), new THREE.Vector3(0, 0, 0), upVector);
        mesh.quaternion.setFromRotationMatrix(matrix);
        mesh.userData = { project, isPlaceholder: true };
        if (scene) {
          scene.add(mesh);
          meshesRef.current.push(mesh);
        }
      }
    };
    
    mockProjects.forEach((project, i) => {
      const normalizedY = 1 - (i / (totalImages - 1)) * 2;
      const radiusAtY = Math.sqrt(1 - normalizedY * normalizedY);
      const theta = goldenAngle * i;
      const normalizedX = Math.cos(theta) * radiusAtY;
      const normalizedZ = Math.sin(theta) * radiusAtY;
      const x = normalizedX * radius;
      const y = normalizedY * radius;
      const z = normalizedZ * radius;
      const inclination = Math.acos(Math.abs(normalizedY));
      const poleFactor = Math.sin(inclination);
      const sizeVariation = 0.92 + 0.08 * poleFactor;
      const adjustedImageSize = optimalBaseSize * sizeVariation;
      const cardWidth = adjustedImageSize;
      const cardHeight = adjustedImageSize * 1.4;
      const delay = i < 30 ? 0 : (i - 30) * 10;
      
      setTimeout(() => {
        if (!sceneRef.current) return;
        textureLoader.load(project.image, (texture) => {
          texture.minFilter = THREE.LinearFilter;
          texture.magFilter = THREE.LinearFilter;
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (!ctx) return;
          canvas.width = 512;
          canvas.height = 512 * 1.4;
          const cornerRadius = 30;
          ctx.beginPath();
          ctx.moveTo(cornerRadius, 0);
          ctx.lineTo(canvas.width - cornerRadius, 0);
          ctx.quadraticCurveTo(canvas.width, 0, canvas.width, cornerRadius);
          ctx.lineTo(canvas.width, canvas.height - cornerRadius);
          ctx.quadraticCurveTo(canvas.width, canvas.height, canvas.width - cornerRadius, canvas.height);
          ctx.lineTo(cornerRadius, canvas.height);
          ctx.quadraticCurveTo(0, canvas.height, 0, canvas.height - cornerRadius);
          ctx.lineTo(0, cornerRadius);
          ctx.quadraticCurveTo(0, 0, cornerRadius, 0);
          ctx.closePath();
          ctx.clip();
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => {
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            const roundedTexture = new THREE.CanvasTexture(canvas);
            roundedTexture.minFilter = THREE.LinearFilter;
            roundedTexture.magFilter = THREE.LinearFilter;
            const material = new THREE.MeshBasicMaterial({ map: roundedTexture, side: THREE.DoubleSide, transparent: true, opacity: 1.0 });
            const geometry = new THREE.PlaneGeometry(cardWidth, cardHeight);
            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.set(x, y, z);
            const upVector = new THREE.Vector3(0, 1, 0);
            if (Math.abs(y) > radius * 0.95) upVector.set(0, 0, 1);
            const matrix = new THREE.Matrix4();
            matrix.lookAt(new THREE.Vector3(x, y, z), new THREE.Vector3(0, 0, 0), upVector);
            mesh.quaternion.setFromRotationMatrix(matrix);
            mesh.userData = { project, index: i };
            if (sceneRef.current) {
              scene.add(mesh);
              meshesRef.current.push(mesh);
            }
            loadedCount++;
            setLoadingProgress(Math.round((loadedCount / totalImages) * 100));
            if (loadedCount === totalImages) {
              window.loadCompleteTime = Date.now();
              setIsLoading(false);
            }
          };
          img.onerror = () => {
            createFallbackTexture(project, x, y, z, adjustedImageSize, scene);
            loadedCount++;
            setLoadingProgress(Math.round((loadedCount / totalImages) * 100));
            if (loadedCount === totalImages) {
              window.loadCompleteTime = Date.now();
              setIsLoading(false);
            }
          };
          img.src = texture.image.src;
        }, undefined, () => {
          createFallbackTexture(project, x, y, z, adjustedImageSize, scene);
          loadedCount++;
          setLoadingProgress(Math.round((loadedCount / totalImages) * 100));
          if (loadedCount === totalImages) {
            window.loadCompleteTime = Date.now();
            setIsLoading(false);
          }
        });
      }, delay);
    });

    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(1, 1, 1);
    scene.add(directionalLight);

    const animate = () => {
      requestAnimationFrame(animate);
      if (sceneRef.current && cameraRef.current && rendererRef.current) {
        if (!isInside) {
          pulseAnimation();
        } else {
          sceneRef.current.scale.set(1, 1, 1);
        }
        const damping = isInside ? 0.15 : 0.12; // Increased damping for smoother rotation
        rotationRef.current.x += (targetRotationRef.current.x - rotationRef.current.x) * damping;
        rotationRef.current.y += (targetRotationRef.current.y - rotationRef.current.y) * damping;
        // Enhanced momentum for touch devices with smoother decay
        if (isInside && isManualDraggingRef.current === false && isNavigatingRef.current === false) {
          const isMobile = isMobileOrTablet();
          const decayFactor = isMobile ? 0.75 : 0.80; // Even slower decay for mobile
          velocityRef.current.x *= decayFactor;
          velocityRef.current.y *= decayFactor;
          targetRotationRef.current.x += velocityRef.current.x;
          targetRotationRef.current.y += velocityRef.current.y;
          if (Math.abs(velocityRef.current.x) < 0.0001 && Math.abs(velocityRef.current.y) < 0.0001) {
            velocityRef.current.x = 0;
            velocityRef.current.y = 0;
          }
        } else if (!isInside && isDraggingRef.current === false) {
          // Apply momentum to outer globe as well
          const isMobile = isMobileOrTablet();
          const decayFactor = isMobile ? 0.75 : 0.80; // Even slower decay for mobile
          velocityRef.current.x *= decayFactor;
          velocityRef.current.y *= decayFactor;
          targetRotationRef.current.x += velocityRef.current.x;
          targetRotationRef.current.y += velocityRef.current.y;
          if (Math.abs(velocityRef.current.x) < 0.0001 && Math.abs(velocityRef.current.y) < 0.0001) {
            velocityRef.current.x = 0;
            velocityRef.current.y = 0;
          }
        }
        // Only apply auto-rotation when not manually dragging and when no manual rotation has been applied
        if (!isDraggingRef.current && !isManualDraggingRef.current && !isNavigatingRef.current && !isInside) {
          // Check if this is the first time auto-rotation is running after manual dragging
          if (manualRotationOffsetRef.current.needsReset) {
            // Reset auto-rotation to match current position
            autoRotationRef.current = targetRotationRef.current.y - (manualRotationOffsetRef.current.y || 0);
            manualRotationOffsetRef.current.needsReset = false;
          }
          
          if (initialAnimationRef.current) {
            const elapsed = Date.now() - (window.loadCompleteTime || Date.now());
            if (elapsed < 3000) {
              autoRotationRef.current += 0.001;
            } else {
              initialAnimationRef.current = false;
              autoRotationRef.current += 0.0002;
            }
          } else {
            autoRotationRef.current += 0.0002;
          }
          // Apply auto-rotation but preserve manual rotation offset
          targetRotationRef.current.y = autoRotationRef.current + (manualRotationOffsetRef.current.y || 0);
        }
        if (isInside && isManualDraggingRef.current === false && isNavigatingRef.current === false) {
          autoRotationRef.current += 0.0001;
          targetRotationRef.current.y += 0.0001;
        }
        sceneRef.current.rotation.x = rotationRef.current.x;
        sceneRef.current.rotation.y = rotationRef.current.y;
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    };
    animate();

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    const onMouseMove = (event) => {
      mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
      mouseRef.current = { x: event.clientX, y: event.clientY };
    };

    const onMouseDown = (event) => {
      const currentTime = Date.now();
      const timeSinceLastClick = currentTime - lastClickTimeRef.current;
      if (timeSinceLastClick < 300 && isInside) {
        isNavigatingRef.current = true;
        isManualDraggingRef.current = false;
        navigationStartRef.current = { x: event.clientX, y: event.clientY };
        dragStartRef.current = { x: event.clientX, y: event.clientY };
        velocityRef.current = { x: 0, y: 0 };
        if (rendererRef.current) {
          rendererRef.current.domElement.style.transition = 'cursor 0.2s ease';
          rendererRef.current.domElement.style.cursor = 'grabbing';
        }
        lastClickTimeRef.current = 0;
        return;
      }
      lastClickTimeRef.current = currentTime;
      clickStartPosRef.current = { x: event.clientX, y: event.clientY };
      if (isInside) {
        isManualDraggingRef.current = true;
        isNavigatingRef.current = false;
        dragStartRef.current = { x: event.clientX, y: event.clientY };
        velocityRef.current = { x: 0, y: 0 };
        if (rendererRef.current) {
          rendererRef.current.domElement.style.transition = 'cursor 0.2s ease';
          rendererRef.current.domElement.style.cursor = 'grabbing';
        }
      } else {
        isDraggingRef.current = true;
        dragStartRef.current = { x: event.clientX, y: event.clientY };
        if (rendererRef.current) {
          rendererRef.current.domElement.style.transition = 'cursor 0.2s ease';
          rendererRef.current.domElement.style.cursor = 'grabbing';
        }
      }
    };

    const onMouseUp = (event) => {
      const deltaX = Math.abs(event.clientX - clickStartPosRef.current.x);
      const deltaY = Math.abs(event.clientY - clickStartPosRef.current.y);
      if (isNavigatingRef.current) {
        isNavigatingRef.current = false;
        if (rendererRef.current) {
          rendererRef.current.domElement.style.transition = 'cursor 0.2s ease';
          rendererRef.current.domElement.style.cursor = 'grab';
        }
        return;
      }
      if (deltaX < 5 && deltaY < 5) {
        if (!isInside) {
          setIsInside(true);
        } else {
          mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
          mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
          if (sceneRef.current && cameraRef.current) {
            raycaster.setFromCamera(mouse, cameraRef.current);
            const intersects = raycaster.intersectObjects(sceneRef.current.children);
            if (intersects.length > 0) {
              const object = intersects[0].object;
              if (object.userData && object.userData.project) setSelectedProject(object.userData.project);
            }
          }
        }
      }
      // Update manual rotation offset when finished dragging
      if (isDraggingRef.current || isManualDraggingRef.current) {
        manualRotationOffsetRef.current.x = targetRotationRef.current.x;
        manualRotationOffsetRef.current.y = targetRotationRef.current.y;
        // Mark that we need to reset auto-rotation to match current position
        manualRotationOffsetRef.current.needsReset = true;
      }
      isDraggingRef.current = false;
      isManualDraggingRef.current = false;
      if (rendererRef.current) {
        rendererRef.current.domElement.style.transition = 'cursor 0.2s ease';
        rendererRef.current.domElement.style.cursor = isInside ? 'grab' : 'pointer';
      }
    };

    const onMouseLeave = () => {
      isDraggingRef.current = false;
      isManualDraggingRef.current = false;
      isNavigatingRef.current = false;
      if (rendererRef.current) {
        rendererRef.current.domElement.style.transition = 'cursor 0.2s ease';
        rendererRef.current.domElement.style.cursor = isInside ? 'grab' : 'pointer';
      }
    };

    // Touch event handlers for mobile support
    const handleTouchStart = (event) => {
      if (event.touches.length > 0) {
        const touch = event.touches[0];
        
        // Store touch start position for tap detection
        clickStartPosRef.current = { x: touch.clientX, y: touch.clientY };
        dragStartRef.current = { x: touch.clientX, y: touch.clientY };
        mouseRef.current = { x: touch.clientX, y: touch.clientY };
        
        // Set touch start time for tap detection
        lastClickTimeRef.current = Date.now();
        
        // Reset velocity for clean start
        velocityRef.current = { x: 0, y: 0 };
        
        // Prevent default to avoid scrolling/zooming on touch devices
        event.preventDefault();
      }
    };

    const handleTouchMove = (event) => {
      if (event.touches.length > 0) {
        const touch = event.touches[0];
        
        // Update mouseRef for consistency
        mouseRef.current = { x: touch.clientX, y: touch.clientY };
        
        // Prevent default to avoid scrolling/zooming on touch devices
        event.preventDefault();
        
        // Check if this is a drag gesture (movement > 5px for more sensitivity)
        const deltaX = Math.abs(touch.clientX - clickStartPosRef.current.x);
        const deltaY = Math.abs(touch.clientY - clickStartPosRef.current.y);
        
        // Respond to any movement for better mobile experience
        if (deltaX > 5 || deltaY > 5) {
          // This is a drag, not a tap
          if (isInside) {
            isManualDraggingRef.current = true;
          } else {
            isDraggingRef.current = true;
          }
          
          // Apply rotation directly during touch move for immediate response
          const moveDeltaX = touch.clientX - dragStartRef.current.x;
          const moveDeltaY = touch.clientY - dragStartRef.current.y;
          
          // Add slight amplification for more noticeable movement on mobile
          const amplifiedDeltaX = moveDeltaX * 1.2; // Slightly amplify horizontal movement
          const amplifiedDeltaY = moveDeltaY * 1.2; // Slightly amplify vertical movement
          
          if (isInside) {
            const sensitivityX = getTouchSensitivity(true); // Horizontal sensitivity
            const sensitivityY = getTouchSensitivity(false); // Vertical sensitivity
            targetRotationRef.current.y += amplifiedDeltaX * sensitivityX;
            targetRotationRef.current.x += amplifiedDeltaY * sensitivityY;
            targetRotationRef.current.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, targetRotationRef.current.x));
          } else {
            const sensitivityX = getTouchSensitivity(true); // Horizontal sensitivity
            const sensitivityY = getTouchSensitivity(false); // Vertical sensitivity
            targetRotationRef.current.y += amplifiedDeltaX * sensitivityX;
            targetRotationRef.current.x += amplifiedDeltaY * sensitivityY;
          }
          
          // Apply momentum for smooth rotation continuation
          if (isDraggingRef.current || isManualDraggingRef.current) {
            // Store velocity for momentum effect with controlled sensitivity
            const isMobile = isMobileOrTablet();
            // Increased momentum for mobile devices for smoother feel
            const momentumFactor = isMobile ? 0.03 : 0.05;
            velocityRef.current.x = amplifiedDeltaY * momentumFactor;
            velocityRef.current.y = amplifiedDeltaX * momentumFactor;
          }
          
          dragStartRef.current = { x: touch.clientX, y: touch.clientY };
        }
      }
    };

    const handleTouchEnd = (event) => {
      // Check if this was a tap (short duration and minimal movement)
      const touchEndTime = Date.now();
      const touchDuration = touchEndTime - lastClickTimeRef.current;
      
      // Use the last touch position for tap detection
      const lastTouchX = mouseRef.current.x || (event.changedTouches && event.changedTouches[0] ? event.changedTouches[0].clientX : 0);
      const lastTouchY = mouseRef.current.y || (event.changedTouches && event.changedTouches[0] ? event.changedTouches[0].clientY : 0);
      
      const deltaX = Math.abs(lastTouchX - clickStartPosRef.current.x);
      const deltaY = Math.abs(lastTouchY - clickStartPosRef.current.y);
      
      // Store whether we were dragging before resetting the flags
      const wasDragging = isDraggingRef.current || isManualDraggingRef.current;
      
      // If it's a tap (short duration and minimal movement)
      if (touchDuration < 500 && deltaX < 15 && deltaY < 15) {
        // Handle tap event
        if (!isInside) {
          // Tap outside - enter the globe
          setIsInside(true);
        } else {
          // Tap inside - try to select a project
          const mouse = new THREE.Vector2();
          mouse.x = (mouseRef.current.x / window.innerWidth) * 2 - 1;
          mouse.y = -(mouseRef.current.y / window.innerHeight) * 2 + 1;
          
          if (sceneRef.current && cameraRef.current) {
            const raycaster = new THREE.Raycaster();
            raycaster.setFromCamera(mouse, cameraRef.current);
            const intersects = raycaster.intersectObjects(sceneRef.current.children);
            
            if (intersects.length > 0) {
              const object = intersects[0].object;
              if (object.userData && object.userData.project) {
                setSelectedProject(object.userData.project);
              }
            }
          }
        }
      }
      
      // Update manual rotation offset when finished dragging (BEFORE resetting flags)
      if (wasDragging) {
        manualRotationOffsetRef.current.x = targetRotationRef.current.x;
        manualRotationOffsetRef.current.y = targetRotationRef.current.y;
        manualRotationOffsetRef.current.needsReset = true;
        
        // Continue momentum after touch end for smooth rotation
        // Maintain some velocity for momentum effect
        // Increased momentum retention for mobile devices
        const isMobile = isMobileOrTablet();
        const momentumRetention = isMobile ? 0.85 : 0.8;
        velocityRef.current.x *= momentumRetention;
        velocityRef.current.y *= momentumRetention;
      }
      
      // Reset dragging state
      isDraggingRef.current = false;
      isManualDraggingRef.current = false;
      
      if (rendererRef.current) {
        rendererRef.current.domElement.style.transition = 'cursor 0.2s ease';
        rendererRef.current.domElement.style.cursor = isInside ? 'grab' : 'pointer';
      }
    };

    if (rendererRef.current) {
      rendererRef.current.domElement.style.cursor = isInside ? 'grab' : 'pointer';
      rendererRef.current.domElement.style.transition = 'cursor 0.2s ease';
      rendererRef.current.domElement.addEventListener('mousemove', onMouseMove);
      rendererRef.current.domElement.addEventListener('mousedown', onMouseDown);
      rendererRef.current.domElement.addEventListener('mouseup', onMouseUp);
      rendererRef.current.domElement.addEventListener('mouseleave', onMouseLeave);
      
      // Add touch event listeners for mobile support
      rendererRef.current.domElement.addEventListener('touchstart', handleTouchStart, { passive: false });
      rendererRef.current.domElement.addEventListener('touchmove', handleTouchMove, { passive: false });
      rendererRef.current.domElement.addEventListener('touchend', handleTouchEnd, { passive: false });
    }

    const handleResize = () => {
      if (cameraRef.current && rendererRef.current) {
        cameraRef.current.aspect = window.innerWidth / window.innerHeight;
        cameraRef.current.updateProjectionMatrix();
        rendererRef.current.setSize(window.innerWidth, window.innerHeight);
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (rendererRef.current) {
        rendererRef.current.domElement.removeEventListener('mousemove', onMouseMove);
        rendererRef.current.domElement.removeEventListener('mousedown', onMouseDown);
        rendererRef.current.domElement.removeEventListener('mouseup', onMouseUp);
        rendererRef.current.domElement.removeEventListener('mouseleave', onMouseLeave);
        
        // Remove touch event listeners
        rendererRef.current.domElement.removeEventListener('touchstart', handleTouchStart);
        rendererRef.current.domElement.removeEventListener('touchmove', handleTouchMove);
        rendererRef.current.domElement.removeEventListener('touchend', handleTouchEnd);
      }
      if (sceneRef.current) {
        while (sceneRef.current.children.length > 0) {
          const child = sceneRef.current.children[0];
          sceneRef.current.remove(child);
          if (child instanceof THREE.Mesh) {
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
              if (child.material.map) child.material.map.dispose();
              child.material.dispose();
            }
          }
        }
      }
      if (rendererRef.current) rendererRef.current.dispose();
    };
  }, [isInside]);

  useEffect(() => {
    const cleanup = initScene();
    return cleanup;
  }, [initScene]);

  useEffect(() => {
    if (cameraRef.current && sceneRef.current) {
      sceneRef.current.background = new THREE.Color(isInside ? 0xe8e8e8 : 0xf5f5f5);
      const targetFOV = isInside ? 100 : 75;
      cameraRef.current.fov = targetFOV;
      cameraRef.current.updateProjectionMatrix();
      const targetZ = isInside ? 0 : 15;
      const startZ = cameraRef.current.position.z;
      const startTime = Date.now();
      const duration = 1000;
      const animateCamera = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easeProgress = 1 - Math.pow(1 - progress, 3);
        if (cameraRef.current) {
          cameraRef.current.position.z = startZ + (targetZ - startZ) * easeProgress;
          cameraRef.current.position.x = 0;
          cameraRef.current.position.y = 0;
        }
        if (progress < 1) requestAnimationFrame(animateCamera);
      };
      animateCamera();
    }
  }, [isInside]);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (isNavigatingRef.current && isInside) {
        const deltaX = e.clientX - dragStartRef.current.x;
        const deltaY = e.clientY - dragStartRef.current.y;
        const sensitivityX = getTouchSensitivity(true); // Horizontal sensitivity
        const sensitivityY = getTouchSensitivity(false); // Vertical sensitivity
        const rotationDeltaX = deltaY * sensitivityY;
        const rotationDeltaY = deltaX * sensitivityX;
        targetRotationRef.current.x += rotationDeltaX;
        targetRotationRef.current.y += rotationDeltaY;
        rotationRef.current.x += rotationDeltaX;
        rotationRef.current.y += rotationDeltaY;
        targetRotationRef.current.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, targetRotationRef.current.x));
        rotationRef.current.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, rotationRef.current.x));
        dragStartRef.current = { x: e.clientX, y: e.clientY };
      } else if (isManualDraggingRef.current && isInside) {
        const deltaX = e.clientX - dragStartRef.current.x;
        const deltaY = e.clientY - dragStartRef.current.y;
        const sensitivityX = getTouchSensitivity(true); // Horizontal sensitivity
        const sensitivityY = getTouchSensitivity(false); // Vertical sensitivity
        const rotationDeltaX = deltaY * sensitivityY;
        const rotationDeltaY = deltaX * sensitivityX;
        velocityRef.current.x = rotationDeltaX;
        velocityRef.current.y = rotationDeltaY;
        targetRotationRef.current.x += rotationDeltaX;
        targetRotationRef.current.y += rotationDeltaY;
        targetRotationRef.current.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, targetRotationRef.current.x));
        dragStartRef.current = { x: e.clientX, y: e.clientY };
      } else if (isDraggingRef.current && !isInside) {
        const deltaX = e.clientX - dragStartRef.current.x;
        const deltaY = e.clientY - dragStartRef.current.y;
        const sensitivityX = getTouchSensitivity(true); // Horizontal sensitivity
        const sensitivityY = getTouchSensitivity(false); // Vertical sensitivity
        targetRotationRef.current.y += deltaX * sensitivityX;
        targetRotationRef.current.x += deltaY * sensitivityY;
        dragStartRef.current = { x: e.clientX, y: e.clientY };
      }
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
      isManualDraggingRef.current = false;
      isNavigatingRef.current = false;
      if (rendererRef.current) {
        rendererRef.current.domElement.style.transition = 'cursor 0.2s ease';
        rendererRef.current.domElement.style.cursor = isInside ? 'grab' : 'pointer';
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isInside]);

  const closeProject = () => setSelectedProject(null);

  return (
    <div className="relative w-full h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div ref={mountRef} className="w-full h-full" />
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30 z-20">
          <div className="bg-white rounded-lg p-6 shadow-xl flex flex-col items-center">
            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-gray-700 font-medium mb-2">Loading projects...</p>
            <p className="text-gray-500 text-sm">{loadingProgress}% complete</p>
            <div className="w-48 h-2 bg-gray-200 rounded-full mt-2 overflow-hidden">
              <div className="h-full bg-blue-500 transition-all duration-300 ease-out" style={{ width: `${loadingProgress}%` }}></div>
            </div>
          </div>
        </div>
      )}
      {isInside && (
        <button onClick={() => setIsInside(false)} className="absolute top-4 right-4 z-10 px-4 py-2 bg-white bg-opacity-80 rounded-lg shadow-lg hover:bg-opacity-100 transition-all">Exit Globe</button>
      )}
      {isInside && !selectedProject && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <button onClick={() => alert('Join button clicked!')} className="pointer-events-auto w-40 h-40 rounded-full bg-black text-white text-xl font-bold shadow-2xl hover:scale-110 transition-transform duration-300 hover:bg-gray-900">Join</button>
        </div>
      )}
      {selectedProject && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black bg-opacity-70" onClick={closeProject}>
          <div className="relative flex flex-col items-center justify-center w-full max-w-2xl mx-4" onClick={(e) => e.stopPropagation()}>
            <TiltedCard imageSrc={selectedProject?.image || ''} altText={selectedProject?.title || ''} onClose={closeProject} />
            <div className="mt-6 flex justify-center">
              <button onClick={closeProject} className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-semibold">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ThreeJSSphereGallery;