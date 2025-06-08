// game.js (обновлено: пути к картинкам городов, выравнивание скорости, сброс ввода при ошибке)
class Particle {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = Math.random() * 5 + 2;
        this.speedX = (Math.random() - 0.5) * 4;
        this.speedY = (Math.random() - 0.5) * 4;
        this.life = 30;
    }

    update() {
        this.x += this.speedX;
        this.y += this.speedY;
        this.life--;
    }

    draw(ctx) {
        ctx.fillStyle = `rgba(255, 165, 0, ${this.life / 30})`;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
    }
}

class Word {
    constructor(text, x, imgSrc) {
        this.text = text.toUpperCase();
        this.x = x;
        this.y = 0;
        this.speed = 0.3;
        this.imgSrc = imgSrc;
        this.image = new Image();
        this.image.src = imgSrc;
        this.image.onerror = () => console.error(`Не удалось загрузить изображение: ${this.imgSrc}`);
        this.image.onload = () => console.log(`Изображение загружено: ${this.imgSrc}`);
        this.particles = [];
        this.exploding = false;
    }

    update() {
        if (this.exploding) {
            this.particles.forEach(p => p.update());
            this.particles = this.particles.filter(p => p.life > 0);
        } else {
            this.y += this.speed;
        }
    }

    draw(ctx, input) {
        if (this.exploding) {
            this.particles.forEach(p => p.draw(ctx));
            return;
        }

        let scaledHeight = 0;
        if (this.image.complete && this.image.naturalWidth !== 0) {
            const maxSize = 200;
            const width = this.image.width;
            const height = this.image.height;
            const scale = Math.min(maxSize / width, maxSize / height);
            const scaledWidth = width * scale;
            scaledHeight = height * scale;
            ctx.drawImage(this.image, this.x - scaledWidth / 2, this.y - scaledHeight / 2, scaledWidth, scaledHeight);
        } else {
            ctx.fillStyle = 'lightgray';
            ctx.fillRect(this.x - 50, this.y - 50, 100, 100);
            ctx.fillStyle = 'black';
            ctx.fillText('?', this.x - 10, this.y + 10);
        }

        ctx.font = '25px Arial';
        const inputUpper = input.toUpperCase();
        let matchedLength = 0;
        for (let i = 0; i < inputUpper.length && i < this.text.length; i++) {
            if (inputUpper[i] === this.text[i]) matchedLength++;
            else break;
        }
        for (let i = 0; i < this.text.length; i++) {
            ctx.fillStyle = i < matchedLength ? 'lime' : 'white';
            const textX = this.x + (i * 20) - (this.text.length * 10);
            const textY = this.y + scaledHeight / 2 + 30;
            ctx.fillText(this.text[i], textX, textY);
        }
    }

    explode() {
        this.exploding = true;
        for (let i = 0; i < 20; i++) this.particles.push(new Particle(this.x, this.y));
    }
}

class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.canvas.width = 800;
        this.canvas.height = 600;
        this.words = [];
        this.score = 0;
        this.level = 1;
        this.spawnDelay = 2000;
        this.lastSpawn = 0;
        this.input = '';
        this.themes = { 'cities': [], 'footballers': [] };
        this.wordMapping = {};
        this.currentTheme = 'cities';
        this.isPaused = false;
        this.loadData();
    }

    async loadData() {
        try {
            const responses = await Promise.all([
                fetch('countries_full_ru.txt').then(r => r.text()),
                fetch('footballers.txt').then(r => r.text()),
                fetch('wordMapping.json').then(r => r.json())
            ]);
            const [countriesText, footballersText, mapping] = responses;

            this.themes.cities = countriesText.split('\n')
                .map(line => {
                    const parts = line.split(' - ');
                    return parts.length === 3 ? { capital: parts[2].trim(), code: parts[1].trim() } : null;
                })
                .filter(item => item !== null);

            this.themes.footballers = footballersText.split('\n')
                .map(line => line.trim())
                .filter(line => line.length > 0)
                .map(name => ({ name }));

            this.wordMapping = mapping;
            this.startGame();
        } catch (error) {
            console.error('Ошибка загрузки данных:', error);
            alert('Не удалось загрузить данные. Проверьте наличие файлов.');
        }
    }

    startGame() {
        const themeSelect = document.getElementById('themeSelect');
        themeSelect.addEventListener('change', e => {
            this.currentTheme = e.target.value;
            this.endGame();
        });

        document.getElementById('startButton').addEventListener('click', () => {
            if (!this.isPaused) this.gameLoop();
            this.isPaused = false;
        });
        document.getElementById('pauseButton').addEventListener('click', () => this.pauseGame());
        document.getElementById('endButton').addEventListener('click', () => this.endGame());

        document.addEventListener('keydown', e => {
            if (this.isPaused) return;
            const key = e.key;
            this.input += key;
            if (this.words.length > 0) {
                const target = this.words[0].text;
                const inputUp = this.input.toUpperCase();
                if (!target.startsWith(inputUp)) {
                    this.input = '';
                    return;
                }
            }
            this.checkInput();
        });
    }

    getImagePath(word) {
        if (this.currentTheme === 'cities') {
            const code = this.wordMapping.cities[word];
            return code ? `images/capitals/${code.toUpperCase()}.png` : null;
        } else if (this.currentTheme === 'footballers') {
            const code = this.wordMapping.footballers[word];
            return code ? `images/footballers/${code}.png` : null;
        }
        return null;
    }

    spawnWord() {
        const themeData = this.themes[this.currentTheme];
        if (!themeData.length || this.words.length) return;

        const randomItem = themeData[Math.floor(Math.random() * themeData.length)];
        const wordText = this.currentTheme === 'cities' ? randomItem.capital : randomItem.name;
        const imgSrc = this.getImagePath(wordText);
        if (!imgSrc) return;

        const minX = this.canvas.width * 0.35;
        const maxX = this.canvas.width * 0.65 - 100;
        const x = minX + Math.random() * (maxX - minX);

        const word = new Word(wordText, x, imgSrc);
        word.speed = 0.3;  // единая скорость
        this.words.push(word);
    }

    gameLoop() {
        if (this.isPaused) return;
        const now = Date.now();
        if (now - this.lastSpawn > this.spawnDelay) {
            this.spawnWord();
            this.lastSpawn = now;
        }
        this.update();
        this.draw();
        requestAnimationFrame(() => this.gameLoop());
    }

    update() {
        this.words.forEach((word, idx) => {
            word.update();
            if (word.exploding && !word.particles.length) {
                this.words.splice(idx, 1);
                this.spawnWord();
            } else if (!word.exploding && word.y > this.canvas.height) {
                this.words.splice(idx, 1);
            }
        });
        if (this.score >= 50 && this.level === 1) {
            this.level = 2;
            this.words.forEach(w => w.speed = 0.6);
        }
    }

    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.words.forEach(w => w.draw(this.ctx, this.input));
        document.getElementById('score').textContent = `Очки: ${this.score} (Уровень ${this.level})`;
    }

    checkInput() {
        if (!this.words.length || !this.input) return;
        if (this.words[0].text === this.input.toUpperCase()) {
            this.words[0].explode();
            this.score += 10;
            this.input = '';
        }
    }

    pauseGame() {
        this.isPaused = !this.isPaused;
        if (this.isPaused) this.input = '';
    }

    endGame() {
        this.isPaused = true;
        this.words = [];
        this.score = 0;
        this.level = 1;
        this.input = '';
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        document.getElementById('score').textContent = `Очки: 0 (Уровень 1)`;
    }
}

const game = new Game();
