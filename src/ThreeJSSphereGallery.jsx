import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';

// TiltedCard Component
const TiltedCard = ({ 
  imageSrc,
  altText,
  captionText,
  containerHeight = "500px",
  containerWidth = "400px",
  imageHeight = "500px",
  imageWidth = "400px",
  rotateAmplitude = 12,
  scaleOnHover = 1.05,
  showMobileWarning = false,
  showTooltip = true,
  displayOverlayContent = true,
  overlayContent,
  onClose
}) => {
  const cardRef = useRef(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
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
      const rotateX = ((y - centerY) / centerY) * rotateAmplitude;
      const rotateY = ((centerX - x) / centerX) * rotateAmplitude;

      animationFrameId = requestAnimationFrame(() => {
        card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(${scaleOnHover})`;
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
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [isMobile, rotateAmplitude, scaleOnHover]);

  return (
    <div className="relative flex items-center justify-center">
      {showMobileWarning && isMobile && (
        <div className="absolute top-0 left-0 right-0 bg-yellow-100 text-yellow-800 p-2 text-center text-sm z-10">
          Tilt effect is disabled on mobile devices
        </div>
      )}
      <div
        ref={cardRef}
        style={{
          height: containerHeight,
          width: containerWidth,
          transition: 'transform 0.1s ease-out',
          transformStyle: 'preserve-3d',
        }}
        className="relative rounded-lg shadow-2xl overflow-hidden"
      >
        <img
          src={imageSrc}
          alt={altText}
          style={{
            height: imageHeight,
            width: imageWidth,
          }}
          className="object-cover w-full h-full"
        />
        {displayOverlayContent && overlayContent && (
          <div className="absolute inset-0 flex items-center justify-center">
            {overlayContent}
          </div>
        )}
        {captionText && (
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent p-4">
            <p className="text-white text-center font-semibold">{captionText}</p>
          </div>
        )}
      </div>
    </div>
  );
};

// Mock projects data
const mockProjects = Array.from({ length: 150 }, (_, i) => {
  const imageIndex = i + 1;
  // All images now use uppercase .JPG extension
  const imagePath = `/images/${imageIndex}.JPG`;
  
  return {
    id: i + 1,
    title: `Project ${i + 1}`,
    image: imagePath
  };
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
  const raycasterRef = useRef(null);
  const mouseVectorRef = useRef(new THREE.Vector2());
  
  const [isInside, setIsInside] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [isLoading, setIsLoading] = useState(true); // Set to true initially
  const loadedImagesRef = useRef(new Set());
  const initialAnimationRef = useRef(true);
  
  // Function to detect if device is mobile or tablet
  const isMobileOrTablet = () => {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
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
    // Load background image
    const backgroundTextureLoader = new THREE.TextureLoader();
    backgroundTextureLoader.load('/assets/background.jpeg', (texture) => {
      if (sceneRef.current) {
        sceneRef.current.background = texture;
      }
    }, undefined, (error) => {
      console.warn('Failed to load background image, using solid color fallback:', error);
      if (sceneRef.current) {
        sceneRef.current.background = new THREE.Color(isInside ? 0xe8e8e8 : 0xf5f5f5);
      }
    });
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(
      isInside ? 100 : 75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
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
      if (sceneRef.current && !isInside) {
        sceneRef.current.scale.set(scale, scale, scale);
      }
    };

    mockProjects.forEach((project, i) => {
      const rows = 10;
      const row = Math.floor(i / (mockProjects.length / rows));
      const col = i % Math.ceil(mockProjects.length / rows);
      
      const inclination = (row / (rows - 1)) * Math.PI;
      const itemsInRow = Math.ceil(mockProjects.length / rows);
      const azimuth = (col / itemsInRow) * Math.PI * 2;
      
      const adjustedRadius = radius;
      const x = adjustedRadius * Math.sin(inclination) * Math.cos(azimuth);
      const y = adjustedRadius * Math.cos(inclination);
      const z = adjustedRadius * Math.sin(inclination) * Math.sin(azimuth);
      
      const poleFactor = Math.sin(inclination);
      const baseSize = 0.6;
      const adjustedImageSize = baseSize * (0.5 + 0.5 * poleFactor);
      
      const cardWidth = adjustedImageSize;
      const cardHeight = adjustedImageSize * 1.4;
      
      const lowResUrl = project.image;
      const highResUrl = project.image;
      
      // Add staggered loading to improve performance
      // When inside the globe, load images faster
      const immediateLoadCount = isInside ? Math.min(100, mockProjects.length) : 30;
      const delay = i < immediateLoadCount ? 0 : (i - immediateLoadCount) * (isInside ? 2 : 10);
      
      setTimeout(() => {
        if (!sceneRef.current) return;
        
        // Add error handling for texture loading
        textureLoader.load(
          lowResUrl,
          (texture) => {
            texture.minFilter = THREE.LinearFilter;
            texture.magFilter = THREE.LinearFilter;
            
            const createTextureFromImage = (imgTexture, isHighRes = false) => {
              const canvas = document.createElement('canvas');
              const ctx = canvas.getContext('2d');
              if (!ctx) {
                console.warn(`Failed to get 2D context for image ${lowResUrl}`);
                return;
              }
              
              canvas.width = isHighRes ? 256 : 32; // Reduced sizes for better performance
              canvas.height = (isHighRes ? 256 : 32) * 1.4; // Maintain aspect ratio
              
              const cornerRadius = isHighRes ? 10 : 2; // Adjusted corner radius
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
                
                if (!isHighRes) {
                  const material = new THREE.MeshBasicMaterial({ 
                    map: roundedTexture,
                    side: THREE.DoubleSide,
                    transparent: true,
                    opacity: 1.0
                  });
                  
                  const geometry = new THREE.PlaneGeometry(cardWidth, cardHeight);
                  const mesh = new THREE.Mesh(geometry, material);
                  mesh.position.set(x, y, z);
                  
                  const targetPosition = new THREE.Vector3(0, 0, 0);
                  const meshPosition = new THREE.Vector3(x, y, z);
                  
                  const upVector = new THREE.Vector3(0, 1, 0);
                  if (Math.abs(y) > radius * 0.95) {
                    upVector.set(0, 0, 1);
                  }
                  
                  const matrix = new THREE.Matrix4();
                  matrix.lookAt(meshPosition, targetPosition, upVector);
                  mesh.quaternion.setFromRotationMatrix(matrix);
                  
                  mesh.userData = { 
                    project, 
                    index: i, 
                    isLowRes: true,
                    highResUrl: highResUrl,
                    highResLoaded: false
                  };
                  
                  // Check if scene still exists before adding
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
                  
                } else {
                  const existingMesh = meshesRef.current.find(
                    m => m.userData.index === i && m.userData.isLowRes
                  );
                  
                  if (existingMesh && existingMesh.material) {
                    if (Array.isArray(existingMesh.material) || !existingMesh.material.map) return;
                    const oldMap = existingMesh.material.map;
                    existingMesh.material.map = roundedTexture;
                    existingMesh.material.needsUpdate = true;
                    existingMesh.userData.isLowRes = false;
                    existingMesh.userData.highResLoaded = true;
                    
                    if (oldMap) oldMap.dispose();
                  }
                }
              };
              img.onerror = (err) => {
                console.error(`Failed to load image for project ${project.id} from path ${project.image}:`, err);
                console.error(`File path: ${project.image}`);
                if (!isHighRes) {
                  // Handle low-res image loading error with a fallback
                  createFallbackTexture(project, x, y, z, adjustedImageSize, scene, i);
                  loadedCount++;
                  setLoadingProgress(Math.round((loadedCount / totalImages) * 100));
                  if (loadedCount === totalImages) {
                    window.loadCompleteTime = Date.now();
                    setIsLoading(false);
                  }
                }
              };
              img.src = imgTexture.image.src;
            };
            
            createTextureFromImage(texture, false);
          },
          undefined,
          (error) => {
            console.warn(`Failed to load texture ${lowResUrl} for project ${project.id}:`, error);
            console.warn(`File path: ${project.image}`);
            // Create a fallback texture when texture loading fails
            createFallbackTexture(project, x, y, z, adjustedImageSize, scene, i);
            loadedCount++;
            setLoadingProgress(Math.round((loadedCount / totalImages) * 100));
            if (loadedCount === totalImages) {
              window.loadCompleteTime = Date.now();
              setIsLoading(false);
            }
          }
        );
      }, delay); // Stagger loading for better performance
    });

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

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
        
        const damping = isInside ? 0.05 : 0.03;
        rotationRef.current.x += (targetRotationRef.current.x - rotationRef.current.x) * damping;
        rotationRef.current.y += (targetRotationRef.current.y - rotationRef.current.y) * damping;

        if (isInside && !isManualDraggingRef.current) {
          velocityRef.current.x *= 0.95;
          velocityRef.current.y *= 0.95;
          
          targetRotationRef.current.x += velocityRef.current.x;
          targetRotationRef.current.y += velocityRef.current.y;
          
          if (Math.abs(velocityRef.current.x) < 0.0001 && Math.abs(velocityRef.current.y) < 0.0001) {
            velocityRef.current.x = 0;
            velocityRef.current.y = 0;
          }
        }

        if (!isDraggingRef.current && !isManualDraggingRef.current && !isInside) {
          if (initialAnimationRef.current) {
            const elapsed = Date.now() - (window.loadCompleteTime || Date.now());
            if (elapsed < 3000) {
              autoRotationRef.current += 0.005;
            } else {
              initialAnimationRef.current = false;
              autoRotationRef.current += 0.001;
            }
          } else {
            autoRotationRef.current += 0.001;
          }
          targetRotationRef.current.y = autoRotationRef.current + manualRotationOffsetRef.current.y;
        }

        sceneRef.current.rotation.x = rotationRef.current.x;
        sceneRef.current.rotation.y = rotationRef.current.y;

        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    };

    // Add this helper function inside the initScene function
    const createFallbackTexture = (project, x, y, z, adjustedImageSize, scene, index) => {
      let material;
      const canvas = document.createElement('canvas');
      const imageSize = 128;
      canvas.width = imageSize;
      canvas.height = imageSize * 1.4;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Draw gradient background
        const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
        gradient.addColorStop(0, '#6366f1'); // indigo-500
        gradient.addColorStop(1, '#8b5cf6'); // violet-500
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Draw a large project icon
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 60px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('📷', canvas.width/2, canvas.height/2 - 10);
        
        // Draw project ID
        ctx.font = 'bold 20px Arial';
        ctx.fillText(`#${project.id}`, canvas.width/2, canvas.height/2 + 40);
        
        // Draw project title
        ctx.font = '14px Arial';
        ctx.fillText(project.title, canvas.width/2, canvas.height - 20);
        
        // Add a small "Image Unavailable" text
        ctx.font = '12px Arial';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.fillText('Image Unavailable', canvas.width/2, 20);
        
        const placeholderTexture = new THREE.CanvasTexture(canvas);
        placeholderTexture.minFilter = THREE.LinearFilter;
        placeholderTexture.magFilter = THREE.LinearFilter;
        
        material = new THREE.MeshBasicMaterial({ 
          map: placeholderTexture,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.9
        });
        
        // Create a plane geometry for the texture
        const width = adjustedImageSize;
        const height = adjustedImageSize * 1.4;
        const geometry = new THREE.PlaneGeometry(width, height);
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(x, y, z);
        
        const targetPosition = new THREE.Vector3(0, 0, 0);
        const meshPosition = new THREE.Vector3(x, y, z);
        
        const upVector = new THREE.Vector3(0, 1, 0);
        if (Math.abs(y) > radius * 0.95) {  // Using the radius variable
          upVector.set(0, 0, 1);
        }
        
        const matrix = new THREE.Matrix4();
        matrix.lookAt(meshPosition, targetPosition, upVector);
        mesh.quaternion.setFromRotationMatrix(matrix);
        
        mesh.userData = { project, index, isPlaceholder: true };
        
        // Check if scene still exists before adding
        if (scene) {
          scene.add(mesh);
          meshesRef.current.push(mesh);
        }
      } else {
        // Fallback to shape geometry if canvas creation fails
        const roundedRectShape = new THREE.Shape();
        const cornerRadius = adjustedImageSize * 0.1;
        const width = adjustedImageSize;
        const height = adjustedImageSize * 1.3;
        
        roundedRectShape.moveTo(-width/2 + cornerRadius, -height/2);
        roundedRectShape.lineTo(width/2 - cornerRadius, -height/2);
        roundedRectShape.quadraticCurveTo(width/2, -height/2, width/2, -height/2 + cornerRadius);
        roundedRectShape.lineTo(width/2, height/2 - cornerRadius);
        roundedRectShape.quadraticCurveTo(width/2, height/2, width/2 - cornerRadius, height/2);
        roundedRectShape.lineTo(-width/2 + cornerRadius, height/2);
        roundedRectShape.quadraticCurveTo(-width/2, height/2, -width/2, height/2 - cornerRadius);
        roundedRectShape.lineTo(-width/2, -height/2 + cornerRadius);
        roundedRectShape.quadraticCurveTo(-width/2, -height/2, -width/2 + cornerRadius, -height/2);
        
        const roundedGeometry = new THREE.ShapeGeometry(roundedRectShape);
        material = new THREE.MeshBasicMaterial({ 
          color: 0x8b5cf6, // violet-500
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.9
        });
        
        const mesh = new THREE.Mesh(roundedGeometry, material);
        mesh.position.set(x, y, z);
        
        const up = new THREE.Vector3(0, 1, 0);
        const rotationMatrix = new THREE.Matrix4();
        rotationMatrix.lookAt(mesh.position, new THREE.Vector3(0, 0, 0), up);
        mesh.setRotationFromMatrix(rotationMatrix);
        
        mesh.userData = { project, index, isPlaceholder: true };
        
        // Check if scene still exists before adding
        if (scene) {
          scene.add(mesh);
          meshesRef.current.push(mesh);
        }
      }
    };

    animate();

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    raycasterRef.current = raycaster;
    mouseVectorRef.current = mouse;

    const onMouseMove = (event) => {
      mouseVectorRef.current.x = (event.clientX / window.innerWidth) * 2 - 1;
      mouseVectorRef.current.y = -(event.clientY / window.innerHeight) * 2 + 1;
      
      mouseRef.current = {
        x: event.clientX,
        y: event.clientY
      };
    };

    const onMouseDown = (event) => {
      clickStartPosRef.current = { x: event.clientX, y: event.clientY };
      
      if (isInside) {
        isManualDraggingRef.current = true;
        dragStartRef.current = { x: event.clientX, y: event.clientY };
        velocityRef.current = { x: 0, y: 0 };
        if (rendererRef.current) {
          rendererRef.current.domElement.style.cursor = 'grabbing';
        }
      } else {
        isDraggingRef.current = true;
        dragStartRef.current = { x: event.clientX, y: event.clientY };
        if (rendererRef.current) {
          rendererRef.current.domElement.style.cursor = 'grabbing';
        }
      }
    };

    const onMouseUp = (event) => {
      const deltaX = Math.abs(event.clientX - clickStartPosRef.current.x);
      const deltaY = Math.abs(event.clientY - clickStartPosRef.current.y);
      
      if (deltaX < 5 && deltaY < 5) {
        if (!isInside) {
          setIsInside(true);
        } else {
          mouseVectorRef.current.x = (event.clientX / window.innerWidth) * 2 - 1;
          mouseVectorRef.current.y = -(event.clientY / window.innerHeight) * 2 + 1;
          
          if (sceneRef.current && cameraRef.current && raycasterRef.current) {
            raycasterRef.current.setFromCamera(mouseVectorRef.current, cameraRef.current);
            const intersects = raycasterRef.current.intersectObjects(sceneRef.current.children);
            
            if (intersects.length > 0) {
              const object = intersects[0].object;
              if (object.userData && object.userData.project) {
                const clickedProject = object.userData.project;
                setSelectedProject(clickedProject);
                
                // Load high resolution image when clicking on a card
                if (object.userData.isLowRes && object.userData.highResUrl && !object.userData.highResLoaded) {
                  // Ensure the highResUrl uses the correct extension
                  const correctedHighResUrl = clickedProject.image;
                  
                  const loader = new THREE.TextureLoader();
                  loader.load(correctedHighResUrl, (highResTexture) => {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    if (!ctx) return;
                    
                    canvas.width = 512;
                    canvas.height = 512 * 1.4;
                    
                    const cornerRadius = 20;
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
                      
                      if ('material' in object && object.material && !Array.isArray(object.material) && object.material.map) {
                        const oldMap = object.material.map;
                        object.material.map = roundedTexture;
                        object.material.needsUpdate = true;
                        object.userData.isLowRes = false;
                        object.userData.highResLoaded = true;
                        if (oldMap) oldMap.dispose();
                      }
                    };
                    img.onerror = () => {
                      console.warn(`Failed to load high-res image: ${correctedHighResUrl}`);
                      // Keep the low-res version if high-res fails
                    };
                    img.src = highResTexture.image.src;
                  }, undefined, (error) => {
                    console.warn(`Failed to load high-res texture: ${correctedHighResUrl}`, error);
                    // Keep the low-res version if high-res fails
                  });
                }
              }
            }
          }
        }
      }
      
      isDraggingRef.current = false;
      isManualDraggingRef.current = false;
      if (rendererRef.current) {
        rendererRef.current.domElement.style.cursor = isInside ? 'grab' : 'pointer';
      }
    };

    const onMouseLeave = () => {
      isDraggingRef.current = false;
      isManualDraggingRef.current = false;
      if (rendererRef.current) {
        rendererRef.current.domElement.style.cursor = isInside ? 'grab' : 'pointer';
      }
    };

    // Touch event handlers for mobile
    const onTouchStart = (event) => {
      if (event.touches.length === 1) {
        const touch = event.touches[0];
        clickStartPosRef.current = { x: touch.clientX, y: touch.clientY };
        
        if (isInside) {
          isManualDraggingRef.current = true;
          dragStartRef.current = { x: touch.clientX, y: touch.clientY };
          velocityRef.current = { x: 0, y: 0 };
        } else {
          isDraggingRef.current = true;
          dragStartRef.current = { x: touch.clientX, y: touch.clientY };
        }
      }
    };

    const onTouchMove = (event) => {
      if (event.touches.length === 1) {
        event.preventDefault();
        const touch = event.touches[0];
        
        if (isInside && isManualDraggingRef.current) {
          const deltaX = touch.clientX - dragStartRef.current.x;
          const deltaY = touch.clientY - dragStartRef.current.y;
          
          // Use lower sensitivity for mobile/tablet devices
          const baseSensitivity = 0.004;
          const sensitivity = isMobileOrTablet() ? baseSensitivity * 0.5 : baseSensitivity;
          const rotationDeltaX = deltaY * sensitivity;
          const rotationDeltaY = deltaX * sensitivity;
          
          velocityRef.current.x = rotationDeltaX;
          velocityRef.current.y = rotationDeltaY;
          
          targetRotationRef.current.x += rotationDeltaX;
          targetRotationRef.current.y += rotationDeltaY;
          
          targetRotationRef.current.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, targetRotationRef.current.x));
          
          dragStartRef.current = { x: touch.clientX, y: touch.clientY };
        } else if (isDraggingRef.current && !isInside) {
          const deltaX = touch.clientX - dragStartRef.current.x;
          const deltaY = touch.clientY - dragStartRef.current.y;
          
          // Use lower sensitivity for mobile/tablet devices
          const baseSensitivity = 0.0025;
          const sensitivity = isMobileOrTablet() ? baseSensitivity * 0.5 : baseSensitivity;
          
          targetRotationRef.current.y += deltaX * sensitivity;
          targetRotationRef.current.x += deltaY * sensitivity;
          
          dragStartRef.current = { x: touch.clientX, y: touch.clientY };
        }
      }
    };

    const onTouchEnd = (event) => {
      if (event.changedTouches.length === 1) {
        const touch = event.changedTouches[0];
        const deltaX = Math.abs(touch.clientX - clickStartPosRef.current.x);
        const deltaY = Math.abs(touch.clientY - clickStartPosRef.current.y);
        
        if (deltaX < 5 && deltaY < 5) {
          if (!isInside) {
            setIsInside(true);
          } else {
            mouseVectorRef.current.x = (touch.clientX / window.innerWidth) * 2 - 1;
            mouseVectorRef.current.y = -(touch.clientY / window.innerHeight) * 2 + 1;
            
            if (sceneRef.current && cameraRef.current && raycasterRef.current) {
              raycasterRef.current.setFromCamera(mouseVectorRef.current, cameraRef.current);
              const intersects = raycasterRef.current.intersectObjects(sceneRef.current.children);
              
              if (intersects.length > 0) {
                const object = intersects[0].object;
                if (object.userData && object.userData.project) {
                  const clickedProject = object.userData.project;
                  setSelectedProject(clickedProject);
                  
                  if (object.userData.isLowRes && object.userData.highResUrl && !object.userData.highResLoaded) {
                    const correctedHighResUrl = clickedProject.image;
                    
                    const loader = new THREE.TextureLoader();
                    loader.load(correctedHighResUrl, (highResTexture) => {
                      const canvas = document.createElement('canvas');
                      const ctx = canvas.getContext('2d');
                      if (!ctx) return;
                      
                      canvas.width = 512;
                      canvas.height = 512 * 1.4;
                      
                      const cornerRadius = 20;
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
                        
                        if ('material' in object && object.material && !Array.isArray(object.material) && object.material.map) {
                          const oldMap = object.material.map;
                          object.material.map = roundedTexture;
                          object.material.needsUpdate = true;
                          object.userData.isLowRes = false;
                          object.userData.highResLoaded = true;
                          if (oldMap) oldMap.dispose();
                        }
                      };
                      img.onerror = () => {
                        console.warn(`Failed to load high-res image: ${correctedHighResUrl}`);
                      };
                      img.src = highResTexture.image.src;
                    }, undefined, (error) => {
                      console.warn(`Failed to load high-res texture: ${correctedHighResUrl}`, error);
                    });
                  }
                }
              }
            }
          }
        }
        
        isDraggingRef.current = false;
        isManualDraggingRef.current = false;
      }
    };

    if (rendererRef.current) {
      rendererRef.current.domElement.style.cursor = isInside ? 'grab' : 'pointer';
      rendererRef.current.domElement.addEventListener('mousemove', onMouseMove);
      rendererRef.current.domElement.addEventListener('mousedown', onMouseDown);
      rendererRef.current.domElement.addEventListener('mouseup', onMouseUp);
      rendererRef.current.domElement.addEventListener('mouseleave', onMouseLeave);
      rendererRef.current.domElement.addEventListener('touchstart', onTouchStart, { passive: false });
      rendererRef.current.domElement.addEventListener('touchmove', onTouchMove, { passive: false });
      rendererRef.current.domElement.addEventListener('touchend', onTouchEnd);
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
        rendererRef.current.domElement.removeEventListener('touchstart', onTouchStart);
        rendererRef.current.domElement.removeEventListener('touchmove', onTouchMove);
        rendererRef.current.domElement.removeEventListener('touchend', onTouchEnd);
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
      
      if (rendererRef.current) {
        rendererRef.current.dispose();
      }
    };
  }, [isInside, isLoading]);

  useEffect(() => {
    const cleanup = initScene();
    return cleanup;
  }, [initScene, isInside]);

  useEffect(() => {
    if (cameraRef.current && sceneRef.current) {
      // Load background image
      const backgroundTextureLoader = new THREE.TextureLoader();
      backgroundTextureLoader.load('/assets/background.jpeg', (texture) => {
        if (sceneRef.current) {
          sceneRef.current.background = texture;
        }
      }, undefined, (error) => {
        console.warn('Failed to load background image, using solid color fallback:', error);
        if (sceneRef.current) {
          sceneRef.current.background = new THREE.Color(isInside ? 0xe8e8e8 : 0xf5f5f5);
        }
      });
      
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
        
        if (progress < 1) {
          requestAnimationFrame(animateCamera);
        }
      };
      
      animateCamera();
    }
  }, [isInside]);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (isInside && isManualDraggingRef.current) {
        const deltaX = e.clientX - dragStartRef.current.x;
        const deltaY = e.clientY - dragStartRef.current.y;
        
        // Use lower sensitivity for mobile/tablet devices
        const baseSensitivity = 0.004;
        const sensitivity = isMobileOrTablet() ? baseSensitivity * 0.5 : baseSensitivity;
        const rotationDeltaX = deltaY * sensitivity;
        const rotationDeltaY = deltaX * sensitivity;
        
        velocityRef.current.x = rotationDeltaX;
        velocityRef.current.y = rotationDeltaY;
        
        targetRotationRef.current.x += rotationDeltaX;
        targetRotationRef.current.y += rotationDeltaY;
        
        targetRotationRef.current.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, targetRotationRef.current.x));
        
        dragStartRef.current = { x: e.clientX, y: e.clientY };
      } else if (isDraggingRef.current && !isInside) {
        const deltaX = e.clientX - dragStartRef.current.x;
        const deltaY = e.clientY - dragStartRef.current.y;
        
        // Use lower sensitivity for mobile/tablet devices
        const baseSensitivity = 0.0025;
        const sensitivity = isMobileOrTablet() ? baseSensitivity * 0.5 : baseSensitivity;
        
        targetRotationRef.current.y += deltaX * sensitivity;
        targetRotationRef.current.x += deltaY * sensitivity;
        
        dragStartRef.current = { x: e.clientX, y: e.clientY };
      }
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
      isManualDraggingRef.current = false;
      if (rendererRef.current) {
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

  const toggleView = () => {
    setIsInside(!isInside);
  };

  const closeProject = () => {
    setSelectedProject(null);
  };

  return (
    <div className="relative w-full h-screen bg-gradient-to-br from-gray-50 to-gray-100" style={{ cursor: isInside ? 'grab' : 'pointer' }}>
      <div ref={mountRef} className="w-full h-full" style={{ cursor: isInside ? 'grab' : 'pointer' }} />
      
      {/* Loading indicator */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30 z-20">
          <div className="bg-white rounded-lg p-6 shadow-xl flex flex-col items-center">
            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-gray-700 font-medium mb-2">Loading projects...</p>
            <p className="text-gray-500 text-sm">{loadingProgress}% complete</p>
            <div className="w-48 h-2 bg-gray-200 rounded-full mt-2 overflow-hidden">
              <div 
                className="h-full bg-blue-500 transition-all duration-300 ease-out"
                style={{ width: `${loadingProgress}%` }}
              ></div>
            </div>
          </div>
        </div>
      )}
      
      {isInside && (
        <button
          onClick={toggleView}
          className="absolute top-4 right-4 z-10 px-4 py-2 bg-white bg-opacity-80 rounded-lg shadow-lg hover:bg-opacity-100 transition-all"
        >
          Exit Globe
        </button>
      )}
      
      {isInside && !selectedProject && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <button
            onClick={() => {
              console.log('Join Now clicked');
              alert('Join button clicked!');
            }}
            className={`pointer-events-auto rounded-full bg-black text-white font-bold shadow-2xl hover:scale-110 transition-transform duration-300 hover:bg-gray-900 ${isMobileOrTablet() ? 'w-24 h-24 text-lg' : 'w-40 h-40 text-xl'}`}
          >
            Join
          </button>
        </div>
      )}
      
      {selectedProject && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black bg-opacity-70">
          <div className="relative flex flex-col items-center justify-center w-full max-w-2xl mx-4">
            <TiltedCard
              imageSrc={selectedProject?.image || ''}
              altText={selectedProject?.title || ''}
              captionText=""
              containerHeight={isMobileOrTablet() ? "300px" : "500px"}
              containerWidth={isMobileOrTablet() ? "240px" : "400px"}
              imageHeight={isMobileOrTablet() ? "300px" : "500px"}
              imageWidth={isMobileOrTablet() ? "240px" : "400px"}
              rotateAmplitude={12}
              scaleOnHover={isMobileOrTablet() ? 1.02 : 1.05}
              showMobileWarning={false}
              showTooltip={true}
              displayOverlayContent={false}
              onClose={closeProject}
            />
            <div className="mt-6 flex justify-center">
              <button
                onClick={closeProject}
                className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ThreeJSSphereGallery;
