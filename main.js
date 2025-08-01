import * as THREE from 'https://esm.sh/three@0.153.0';
import { PointerLockControls } from 'https://esm.sh/three@0.153.0/examples/jsm/controls/PointerLockControls.js';

let scene, camera, renderer, controls;
let wall;
let spheres = [];
let yaw = 0;
let pitch = 0;
let score = 0;
let shotsFired = 0; // 玩家点击次数（无论有没有击中）
let timeLeft = 60;
let timerId = null;
let gameStarted = false;
let canStart = true;


const SPHERE_COUNT = 6;
const WALL_WIDTH = 6;
const WALL_HEIGHT = 4;

const FLOOR_WIDTH = 200;
const FLOOR_DEPTH = 200;
const FLOOR_THICKNESS = 1;  // 地板厚度

const scale = 0.01;

const sensitivitySlider = document.getElementById('sensitivity');
const sensitivityNumber = document.getElementById('sensitivityNumber');
const wallDistanceInput = document.getElementById('wallDistance');
const ballSizeInput = document.getElementById('ballSize');
const colorSelector = document.getElementById('colorSelector');
const crosshair = document.getElementById('crosshair');
const scoreText = document.getElementById('scoreText');
const timeText = document.getElementById('timeText');
const accuracyText = document.getElementById('accuracyText');
const gameInfo = document.getElementById('gameInfo');
const resultBox = document.getElementById('resultBox');
const resultScore = document.getElementById('resultScore');
const resultAccuracy = document.getElementById('resultAccuracy');
const resultCloseBtn = document.getElementById('resultCloseBtn');
const resultOverlay = document.getElementById('resultOverlay');
const resultModal = document.getElementById('resultModal');




let sensitivity = parseFloat(sensitivitySlider.value);
let gameRunning = false;
let initialized = false;


const sphereGeometryCache = new Map();
const sphereMaterial = new THREE.MeshStandardMaterial({ color: 0x000000 });

function getSphereGeometry(radius) {
    if (!sphereGeometryCache.has(radius)) {
        sphereGeometryCache.set(radius, new THREE.SphereGeometry(radius, 16, 16));
    }
    return sphereGeometryCache.get(radius);
}

function createWall(distance) {
    if (wall) scene.remove(wall);

    const WALL_THICKNESS = 0.5; // 墙体厚度，可以调整
    const wallMaterial = new THREE.MeshStandardMaterial({ color: 0x666666 });

    const wallGeometry = new THREE.BoxGeometry(WALL_WIDTH, WALL_HEIGHT, WALL_THICKNESS);
    wall = new THREE.Mesh(wallGeometry, wallMaterial);

    wall.position.set(0, WALL_HEIGHT / 2, -distance - WALL_THICKNESS / 2);

    scene.add(wall);
}

function init() {
    if (initialized) return;
    initialized = true;

    scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera(
        75,
        window.innerWidth / window.innerHeight,
        0.1,
        1000
    );
    camera.position.y = 1.6;

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0xa0c8ff, 1);
    document.body.appendChild(renderer.domElement);

    controls = new PointerLockControls(camera, document.body);


    const initialWallDistance = parseFloat(wallDistanceInput.value) || 30;
    createWall(initialWallDistance);

    // 地板：带厚度的盒子
    const floorGeometry = new THREE.BoxGeometry(FLOOR_WIDTH, FLOOR_THICKNESS, FLOOR_DEPTH);
    const floorMaterial = new THREE.MeshStandardMaterial({ color: 0x222222 });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.position.set(0, FLOOR_THICKNESS / 2, 0); // 上表面在 y=0
    scene.add(floor);

    // 光照
    const dirLight = new THREE.DirectionalLight(0xffffff, 1);
    dirLight.position.set(10, 20, 10);
    scene.add(dirLight);
    scene.add(new THREE.AmbientLight(0x666666));

    window.addEventListener('resize', onWindowResize);

    sensitivitySlider.addEventListener('input', (e) => updateSensitivity(e.target.value));
    sensitivityNumber.addEventListener('input', (e) => updateSensitivity(e.target.value));

    wallDistanceInput.addEventListener('input', () => {
        const dist = parseFloat(wallDistanceInput.value);
        if (!isNaN(dist)) {
            createWall(dist);
            spawnSpheres();
        }
    });

    ballSizeInput.addEventListener('input', () => {
        if (gameRunning) spawnSpheres();
    });

    colorSelector.addEventListener('change', (e) => {
        updateCrosshairColor(e.target.value);
    });
    crosshairSize.addEventListener('change', (e) => {
        updateCrosshairSize(e.target.value);
    });
    document.addEventListener('mousemove', onMouseMove);


    animate();
}

function updateCrosshairColor(color) {
    crosshair.style.background = color;
}

function updateCrosshairSize(size) {
    crosshair.style.width = `${size}px`;
    crosshair.style.height = `${size}px`;
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function updateSensitivity(value) {
    let v = parseFloat(value);
    if (isNaN(v)) return;
    v = Math.min(Math.max(v, 0.1), 2);
    sensitivitySlider.value = v;
    sensitivityNumber.value = v;
    sensitivity = v;
}

function onMouseMove(event) {
    if (!controls.isLocked) return;

    yaw -= event.movementX * sensitivity * scale;
    pitch -= event.movementY * sensitivity * scale;

    const pitchLimit = Math.PI / 2 - 0.01;
    pitch = Math.max(-pitchLimit, Math.min(pitchLimit, pitch));

    camera.rotation.set(pitch, yaw, 0);
}

function spawnSpheres() {
    spheres.forEach(s => scene.remove(s));
    spheres = [];

    const maxAttempts = 100;
    const ballSize = parseFloat(ballSizeInput.value) || 1;
    const radius = ballSize;

    const currentWallDistance = parseFloat(wallDistanceInput.value) || 30;

    for (let i = 0; i < SPHERE_COUNT; i++) {
        let valid = false;
        let attempts = 0;
        let newSphere;

        while (!valid && attempts < maxAttempts) {
            const yMin = WALL_HEIGHT * 0.8 + radius - 2;
            const yMax = WALL_HEIGHT * 0.8 - radius;

            const usableWidth = WALL_WIDTH * 0.5;
            const xMin = -usableWidth / 2 + radius;
            const xMax = usableWidth / 2 - radius;
            const x = Math.random() * (xMax - xMin) + xMin;
            const y = Math.random() * (yMax - yMin) + yMin;
            const z = -currentWallDistance + 0.1;
            console.log(x, y, z)
            const geometry = getSphereGeometry(radius);
            newSphere = new THREE.Mesh(geometry, sphereMaterial);
            newSphere.position.set(x, y, z);

            valid = true;
            for (const existing of spheres) {
                if (newSphere.position.distanceTo(existing.position) < 2 * radius + 0.2) {
                    valid = false;
                    break;
                }
            }

            attempts++;
        }

        if (valid) {
            scene.add(newSphere);
            spheres.push(newSphere);
        } else {
            console.warn(`Failed to place sphere ${i + 1} after ${maxAttempts} attempts`);
        }
    }

    updateGameInfo();
}


// 添加射线投射器
const raycaster = new THREE.Raycaster();

function onMouseClick(event) {
    if (!controls.isLocked) return;

    shotsFired++;

    // 计算鼠标中心点屏幕坐标 (NDC坐标系，中心是0,0)
    const mouse = new THREE.Vector2(0, 0);

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(spheres);

    if (intersects.length > 0) {
        // 点中了第一个球体
        const hitSphere = intersects[0].object;
        scene.remove(hitSphere);

        // 从数组删除
        spheres = spheres.filter(s => s !== hitSphere);

        // 得分 +1，刷新一个新球
        score++;
        updateGameInfo();
        spawnOneSphere();
    } else {
        updateGameInfo();
    }
}
document.addEventListener('click', onMouseClick);

function spawnOneSphere() {
    const maxAttempts = 100;
    const ballSize = parseFloat(ballSizeInput.value) || 1;
    const radius = ballSize;
    const currentWallDistance = parseFloat(wallDistanceInput.value) || 30;

    let valid = false;
    let attempts = 0;
    let newSphere;

    while (!valid && attempts < maxAttempts) {
        const yMin = WALL_HEIGHT * 0.8 + radius - 2;
        const yMax = WALL_HEIGHT * 0.8 - radius;

        const usableWidth = WALL_WIDTH * 0.5;
        const xMin = -usableWidth / 2 + radius;
        const xMax = usableWidth / 2 - radius;
        const x = Math.random() * (xMax - xMin) + xMin;
        const y = Math.random() * (yMax - yMin) + yMin;
        const z = -currentWallDistance + 0.1;

        console.log(x, y, z);


        const geometry = getSphereGeometry(radius);
        newSphere = new THREE.Mesh(geometry, sphereMaterial);
        newSphere.position.set(x, y, z);

        valid = true;
        for (const existing of spheres) {
            if (newSphere.position.distanceTo(existing.position) < 2 * radius + 0.2) {
                valid = false;
                break;
            }
        }
        attempts++;
    }

    if (valid) {
        scene.add(newSphere);
        spheres.push(newSphere);
    } else {
        console.warn(`Failed to place sphere after ${maxAttempts} attempts`);
    }
}


function updateGameInfo() {
    scoreText.textContent = `Score: ${score}`;
    timeText.textContent = `Time: ${timeLeft}`;
    let accuracy = shotsFired > 0 ? ((score / shotsFired) * 100).toFixed(1) : 0;
    accuracyText.textContent = `Accuracy: ${accuracy}%`;
}

function showResult(score, accuracy) {
    resultScore.textContent = score;
    resultAccuracy.textContent = `${accuracy}%`;

    resultOverlay.style.display = 'block';
    resultModal.style.display = 'block';

    // 延迟添加类触发动画
    requestAnimationFrame(() => {
        resultOverlay.classList.add('show');
        resultModal.classList.add('show');
    });
}

function hideResult() {
    resultOverlay.classList.remove('show');
    resultModal.classList.remove('show');

    // 等动画结束再隐藏元素
    setTimeout(() => {
        resultOverlay.style.display = 'none';
        resultModal.style.display = 'none';
    }, 400);
}

resultCloseBtn.addEventListener('click', hideResult);
resultOverlay.addEventListener('click', hideResult);

resultCloseBtn.addEventListener('click', () => {
    hideResult();
});

function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
}

window.startGame = function () {
    if (!canStart) return; // 不允许过早开始

    init();


    controls.lock(); // 自动锁定视角

    // 初始化数据
    score = 0;
    shotsFired = 0;
    timeLeft = 60;
    
    updateGameInfo();
    gameInfo.style.display = 'block';

    spawnSpheres();
    // 开始倒计时
    if (timerId) clearInterval(timerId);
    timerId = setInterval(() => {
        timeLeft--;
        updateGameInfo();

        if (timeLeft <= 0) {
            clearInterval(timerId);
            endGame();
        }
    }, 1000);

};


function endGame() {
    controls.unlock();
    spheres.forEach(s => scene.remove(s));
    spheres = [];
    
    // 禁用 startGame 按钮 1 秒
    canStart = false;
    setTimeout(() => {
        canStart = true;
    }, 1000);
    controls.unlock();
}

