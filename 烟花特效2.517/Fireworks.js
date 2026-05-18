let animationId; // 用来记录当前的动画帧ID

const RocketSound = document.getElementById('rocket-sound');
RocketSound.volume = 0.55;
RocketSound.playbackRate = 0.7;

const ClickSound = document.getElementById('click-sound');
ClickSound.volume = 0.4;

const BurningSound = document.getElementById('burning-sound');
BurningSound.volume = 0.3;

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
let w, h;

const STATE = { IDLE: 0, BURNING: 1, LAUNCHING: 2 };
let currentState = STATE.IDLE;

let mouse = { x: window.innerWidth / 2, y: window.innerHeight / 2 };

let fusePath = []; 
let burnIndex = 0;

let rockets = []; 
let particles = []; 
let textPixels = []; 
const TARGET_TEXT = "你是笨蛋";

// 循环发射的时间控制
let lastLaunchTime = 0;
const LAUNCH_INTERVAL = 3000; // 每3000毫秒发射一波烟花

function playSound(audioElement) {//播放音效
    if (audioElement) {
        audioElement.currentTime = 0;
        // catch 是为了防止浏览器拦截自动播放而报错
        audioElement.play().catch(error => console.log("播放被拦截:", error));
    }
}


function init() {//重置状态与特效
    
     if (animationId) {
        cancelAnimationFrame(animationId);
    }

    RocketSound.pause();

    let mouse = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    currentState = STATE.IDLE;//复位状态
    
    //清空特效数据
    fusePath = []; 
    burnIndex = 0;
    rockets = []; 
    particles = []; 
    textPixels = []; 

    document.getElementById('tips').innerText = "点击屏幕点燃烟花";
    ctx.clearRect(0, 0, w, h);
    
    initTextPixels();
    animationId = requestAnimationFrame(loop);
}

function resize() { 
    w = canvas.width = window.innerWidth; 
    h = canvas.height = window.innerHeight; 

    initTextPixels();//随窗口大小更新文字位置，进而使烟花特效跟随
    //requestAnimationFrame(loop);
}

// 初始化文字像素
function initTextPixels() {
    const offCanvas = document.createElement('canvas');
    const offCtx = offCanvas.getContext('2d');
    offCanvas.width = w; offCanvas.height = h;
    let fontSize = Math.min(w / 8, 400);
    offCtx.font = `bold ${fontSize}px "Microsoft YaHei"`;
    offCtx.fillStyle = 'white';
    offCtx.textAlign = 'center';
    offCtx.textBaseline = 'middle';
    offCtx.fillText(TARGET_TEXT, w / 2, h / 2);
    
    const imageData = offCtx.getImageData(0, 0, w, h);
    textPixels = [];
    for (let y = 0; y < h; y += 3) {
        for (let x = 0; x < w; x += 3) {
            if (imageData.data[(y * w + x) * 4 + 3] > 128) {
                textPixels.push({ x, y, brightness: 0 });
            }
        }
    }
}

//点击重置按钮触发变量初始化
document.getElementById('reset').addEventListener('click', (e)=>{
    e.stopPropagation();//阻止点击按钮动作被canvas捕获
    playSound(ClickSound);
    init();
});

// 点击屏幕触发导火索燃烧
window.addEventListener('click', e => {
    playSound(BurningSound);
    if (currentState === STATE.IDLE) {
        currentState = STATE.BURNING;
        initFusePath(e.clientX, e.clientY);
    }
});

// 跟随窗口大小
window.addEventListener('resize', resize);
window.addEventListener('mousemove', e => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
});

// 初始化导火索路径
function initFusePath(startX, startY) {
    fusePath = [];
    const endX = w / 2;
    const endY = h;
    const cpX = (startX + endX) / 2 + (Math.random() - 0.5) * 200;
    const cpY = (startY + endY) / 2;

    for (let t = 0; t <= 1; t += 0.005) {
        const x = (1 - t) * (1 - t) * startX + 2 * (1 - t) * t * cpX + t * t * endX;
        const y = (1 - t) * (1 - t) * startY + 2 * (1 - t) * t * cpY + t * t * endY;
        fusePath.push({ x, y });
    }
}

// 火焰粒子类
class FireParticle {
    constructor(x, y) {
        this.x = x + (Math.random() - 0.5) * 15;
        this.y = y + (Math.random() - 0.5) * 15;
        this.vx = (Math.random() - 0.5) * 1.5;
        this.vy = -Math.random() * 2.5 - 1;
        this.life = 1;
        this.size = Math.random() * 12 + 5;
    }
    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.life -= 0.02;
        this.size *= 0.96;
    }
    draw() {
        ctx.fillStyle = `rgba(255, ${Math.floor(this.life * 200)}, 0, ${this.life})`;//颜色渐变
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
    }
}

// 烟花火箭类（优化：从底部飞向文字区域的特定目标点）
class Rocket {
    constructor(targetX, targetY,color) {
        this.targetX = targetX;
        this.targetY = targetY;
        // 火箭从屏幕底部正对着目标点的下方升起
        this.x = targetX + (Math.random() - 0.5) * 100; 
        this.y = h;
        
        // 计算飞向目标的速度和角度
        const dist = Math.sqrt(Math.pow(targetX - this.x, 2) + Math.pow(targetY - this.y, 2));
        const speed = dist / 60; // 控制飞行时间
        
        this.vx = (targetX - this.x) / 50;
        this.vy = (targetY - this.y) / 50;
        this.exploded = false;
        this.color = color;
    }
    update() {
        this.x += this.vx;
        this.y += this.vy;
        
        // 当火箭非常接近目标点时引爆
        const dist = Math.sqrt(Math.pow(this.targetX - this.x, 2) + Math.pow(this.targetY - this.y, 2));
        if (dist < 25) {
            this.exploded = true;
            createExplosion(this.x, this.y,this.color);
        }
    }
    draw() {

        ctx.shadowBlur = 3;
        ctx.shadowColor = this.color;
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, 3, 8);
    }
}

// 爆炸粒子类
class Particle {
    constructor(x, y,color) {
        this.x = x;
        this.y = y;
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 5 + 3; // 稍微减小爆炸扩散速度，让粒子更集中在文字内
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        this.life = 1;
        this.decay = Math.random() * 0.009 + 0.007;
        this.history = [];
        this.color = color;
    }
    update() {
        this.history.push({x: this.x, y: this.y});
        if (this.history.length > 4) this.history.shift();
        
        this.x += this.vx;
        this.y += this.vy;
        this.vy += 0.03; // 减小重力
        this.vx *= 0.97;
        this.vy *= 0.97;
        
        // 粒子划过文字区域，点亮文字
        for (let p of textPixels) {
            if (Math.abs(p.x - this.x) < 4 && Math.abs(p.y - this.y) < 4) {
                p.color = this.color;
                p.brightness = 1; // 瞬间点亮
            }
        }
        
        this.life -= this.decay;
    }
    draw() {
        if (this.life <= 0) return;
        ctx.beginPath();
        
        //ctx.shadowBlur = 0;
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 3;
        if(this.history.length > 0) {
            ctx.moveTo(this.history[0].x, this.history[0].y);
            for(let p of this.history) 
                ctx.lineTo(p.x, p.y);
                //ctx.lineCap = 'round';
        }
        ctx.stroke();
    }
}

let fireParticles = [];

function createExplosion(x, y,color) {
    for (let i = 0; i < 70; i++) {//炸开七十个粒子
        particles.push(new Particle(x, y,color));
    }
}

function loop(timestamp) {
    //清除残留特效痕迹
     ctx.clearRect(0, 0, w, h);

    // 1. 始终跟随鼠标的火焰特效
    if (currentState === STATE.IDLE || currentState === STATE.BURNING) {
        for(let i=0; i<2; i++) {
        fireParticles.push(new FireParticle(mouse.x, mouse.y));
    }
    for (let i = fireParticles.length - 1; i >= 0; i--) {
        fireParticles[i].update();
        fireParticles[i].draw();
        if (fireParticles[i].life <= 0) 
        fireParticles.splice(i, 1);
    }
    }
    

    // 2. 导火索燃烧逻辑
    if (currentState === STATE.BURNING) {
        if (burnIndex > 0) {
            ctx.beginPath();
            ctx.moveTo(fusePath[0].x, fusePath[0].y);
            for (let i = 0; i < burnIndex; i++)    
                ctx.lineTo(fusePath[i].x, fusePath[i].y);
            ctx.strokeStyle = 'rgba(100, 100, 100, 0.3)';
            ctx.lineWidth = 3;
            ctx.stroke();
        }
        
        if (burnIndex >= fusePath.length) {
            currentState = STATE.LAUNCHING;
            BurningSound.pause();
            BurningSound.currentTime = 0;
            lastLaunchTime = timestamp; // 记录进入发射状态的时间
        } else {
            const head = fusePath[burnIndex];
            for(let i=0; i<5; i++) fireParticles.push(new FireParticle(head.x, head.y));
            
            ctx.beginPath();
            ctx.moveTo(head.x, head.y);
            for (let i = burnIndex; i < fusePath.length; i++) ctx.lineTo(fusePath[i].x, fusePath[i].y);
            ctx.strokeStyle = '#555';
            ctx.lineWidth = 2;
            ctx.stroke();
            
            burnIndex += 2;
        }
    }

    // 3. 烟花循环升空与文字点亮/变暗逻辑
    if (currentState === STATE.LAUNCHING) {
        document.getElementById('tips').innerText = "烟花循环播放中...";
        // 循环发射逻辑：每隔固定时间发射一波
        if (timestamp - lastLaunchTime > LAUNCH_INTERVAL && textPixels.length > 0) {
            // 每次发射 3-8 个火箭，集中轰炸文字区域
            const count = Math.floor(Math.random() * 5) + 3;
            for (let i = 0; i < count; i++) {
                const target = textPixels[Math.floor(Math.random() * textPixels.length)];
                const color = `rgb(${Math.floor(Math.random() * 256)}, ${Math.floor(Math.random() * 256)}, ${Math.floor(Math.random() * 256)})`;
                rockets.push(new Rocket(target.x, target.y,color));
            }
            
            playSound(RocketSound);
            
            lastLaunchTime = timestamp;
        }

        // 更新火箭
        for (let i = rockets.length - 1; i >= 0; i--) {
            rockets[i].update();
            rockets[i].draw();
            if (rockets[i].exploded) rockets.splice(i, 1);
        }

        // 更新爆炸粒子
        for (let i = particles.length - 1; i >= 0; i--) {
            particles[i].update();
            particles[i].draw();
            if (particles[i].life <= 0) particles.splice(i, 1);
        }

        // 绘制文字像素（带缓慢变暗效果）
        for (let p of textPixels) {
            if (p.brightness > 0) {
                p.brightness -= 0.013; // 变暗速度
                if (p.brightness < 0) p.brightness = 0;
                
                ctx.shadowBlur = 0;
                let rgb = p.color.match(/\d+/g);//提取划过文字区域的颜色reb值

                ctx.fillStyle = `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${p.brightness})`;
                ctx.fillRect(p.x, p.y, 3, 3);
            }
        }
    }

    animationId = requestAnimationFrame(loop);
}

// 初始化
resize();
initTextPixels();
requestAnimationFrame(loop);