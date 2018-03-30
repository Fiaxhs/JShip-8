const font = [["11110000", "10010000", "10010000", "10010000", "11110000"], ["00100000", "01100000", "00100000", "00100000", "01110000"], ["11110000", "00010000", "11110000", "10000000", "11110000"], ["11110000", "00010000", "11110000", "00010000", "11110000"], ["10010000", "10010000", "11110000", "00010000", "00010000"], ["11110000", "10000000", "11110000", "00010000", "11110000"], ["11110000", "10000000", "11110000", "10010000", "11110000"], ["11110000", "00010000", "00100000", "01000000", "01000000"], ["11110000", "10010000", "11110000", "10010000", "11110000"], ["11110000", "10010000", "11110000", "00010000", "11110000"], ["11110000", "10010000", "11110000", "10010000", "10010000"], ["11100000", "10010000", "11100000", "10010000", "11100000"], ["11110000", "10000000", "10000000", "10000000", "11110000"], ["11100000", "10010000", "10010000", "10010000", "11100000"], ["11110000", "10000000", "11110000", "10000000", "11110000"], ["11110000", "10000000", "11110000", "10000000", "10000000"]];

const leftPad = (string, pad) => pad.substring(0, pad.length - string.length) + string;

var steps = 10;

class CHIP8 {

	constructor() {
		this.canvas = document.querySelector("#canvas");
		this.speaker = document.querySelector("#speaker");
		this.reset();
		this.animationFrameRequest = null;
		this.initKeypad();
	}

	reset() {
		this.memory = new Uint8Array(4096);
		this.waitingKey = false;
		// Current opcode
		this.opcode = null;
		// Call stack (16 * 16-bit values)
		this.stack = [];
		// Program counter
		this.pc = 0;
		// Data register (16 * 8-bit values)
		this.V = new Uint8Array(16);
		// 16-bit register
		this.I = null;
		this.timers = {
			delay: 0,
			sound: 0
		};
		this.clearScreen();
		this.initFont();
		this.keysPressed = new Map();
		// ROMs start at this address
		this.pc = 0x0200;
		window.cancelAnimationFrame(this.animationFrameRequest);
	}

	// Add font to memory
	initFont() {
		this.pc = 0;
		font.forEach(letter => {
			letter.forEach(byte => {
				this.memory[this.pc] = parseInt(byte, 2);
				this.pc += 0x01;
			});
		});
	}

	// Load rom file
	async readRom(rom) {
		rom = await fetch(`./roms/${rom}`);
		rom = await rom.arrayBuffer();
		rom = new Uint8Array(rom);
		rom.forEach(byte => {
			this.memory[this.pc] = byte;
			this.pc++;
		});
		// Reset pc
		this.pc = 0x0200;
		// Start loop
		this.loop();
	}

	readOpcode() {
		this.opcode = this.memory[this.pc] << 8 | this.memory[this.pc + 1];
	}

	loop() {
		// Beep beep.
		if (this.timers.sound > 0) {
			this.timers.sound -= 1;
			this.speaker.style.visibility = 'visible';
			if (!this.timers.sound) {
				this.speaker.style.visibility = 'hidden';
			}
		}
		if (this.timers.delay > 0) {
			this.timers.delay -= 1;
		} else {
			// Read new instruction unless waiting for key
			if (!this.waitingKey) {
				this.readOpcode();
			}
			// Execute
			this.executeCode();
		}

		// Animate every 10 steps.
		if (steps-- == 0) {
			steps = 1;
			this.animationFrameRequest = window.requestAnimationFrame(this.loop.bind(this));
		} else {
			this.loop();
		}
	}

	executeCode() {
		let NNN = 0x0FFF & this.opcode;
		let NN = 0x00FF & this.opcode;
		let N = 0x000F & this.opcode;
		let X = (0x0F00 & this.opcode) >> 8;
		let Y = (0x00F0 & this.opcode) >> 4;
		let B = 0xF000 & this.opcode;

		switch (B) {

			case 0x0000:
				// 00E0 - CLS
				// Clear the display.
				if (this.opcode === 0x00E0) {
					this.clearScreen();
					this.pc += 2;
				}
				// 00EE - RET
				// Return from a subroutine.
				if (this.opcode === 0x00EE) {
					this.pc = this.stack.pop();
				}
				break;

			case 0x1000:
				// 1NNN - JP addr
				// Jump to location NNN.
				this.pc = NNN;
				break;

			case 0x2000:
				// 2NNN - CALL addr
				// Call subroutine at NNN
				this.stack.push(this.pc + 2);
				this.pc = NNN;
				break;

			case 0x3000:
			case 0x4000:
				// 3xNN - SE Vx, byte
				// Skip next instruction if Vx = NN.
				// 4xNN - SNE Vx, byte
				// Skip next instruction if Vx != NN.
				if (B === 0x3000 == (this.V[X] == NN)) {
					this.pc += 2;
				}
				this.pc += 2;
				break;

			case 0x5000:
				// 5xy0 - SE Vx, Vy
				// Skip next instruction if Vx = Vy.
				if (this.V[X] == this.V[Y]) {
					this.pc += 2;
				}
				this.pc += 2;
				break;

			case 0x6000:
				// 6xNN - LD Vx, byte
				// Set Vx = NN.
				this.V[X] = NN;
				this.pc += 2;
				break;

			case 0x7000:
				// 7xNN - ADD Vx, byte
				// Set Vx = Vx + NN.
				let val = this.V[X] + NN;
				if (val > 255) {
					val -= 256;
				}
				this.V[X] = val;
				this.pc += 2;
				break;

			case 0x8000:
				switch (0x000F & this.opcode) {
					case 0x0000:
						// 8xy0 - LD Vx, Vy
						// Set Vx = Vy.
						this.V[X] = this.V[Y];
						this.pc += 2;
						break;

					case 0x0001:
						// 8xy1 - OR Vx, Vy
						// Set Vx = Vx OR Vy.
						this.V[X] = this.V[X] | this.V[Y];
						this.pc += 2;
						break;

					case 0x0002:
						// 8xy2 - AND Vx, Vy
						// Set Vx = Vx AND Vy.
						this.V[X] = this.V[X] & this.V[Y];
						this.pc += 2;
						break;

					case 0x0003:
						// 8xy3 - XOR Vx, Vy
						// Set Vx = Vx XOR Vy.
						this.V[X] = this.V[X] ^ this.V[Y];
						this.pc += 2;
						break;

					case 0x0004:
						{
							// 8xy4 - ADD Vx, Vy
							// Set Vx = Vx + Vy, set VF = carry.
							let sum = this.V[X] + this.V[Y];
							this.V[15] = 0;
							if (sum > 255) {
								this.V[15] = 1;
								sum = sum -= 256;
							}
							this.V[X] = sum;
							this.pc += 2;
							break;
						}

					case 0x0005:
						{
							// 8xy5 - SUB Vx, Vy
							// Set Vx = Vx - Vy, set VF = NOT borrow.
							let diff = this.V[X] - this.V[Y];
							this.V[15] = 1;
							if (diff < 0) {
								this.V[15] = 0;
								diff += 256;
							}
							this.V[X] = diff;
							this.pc += 2;
							break;
						}

					case 0x0006:
						// 8xy6 - SHR Vx {, Vy}
						// Set Vx = Vx SHR 1.
						// If the least-significant bit of Vx is 1, then VF is set to 1, otherwise 0. Then Vx is divided by 2.
						this.V[15] = this.V[X] & 0x01;
						this.V[X] = this.V[X] >> 1;
						this.pc += 2;
						break;

					case 0x0007:
						{
							// 8xy7 - SUBN Vx, Vy
							// Set Vx = Vy - Vx, set VF = NOT borrow.

							// If Vy > Vx, then VF is set to 1, otherwise 0. Then Vx is subtracted from Vy, and the results stored in Vx.
							let diff = this.V[Y] - this.V[X];
							this.V[15] = 1;
							if (diff < 0) {
								this.V[15] = 0;
								diff += 256;
							}
							this.V[X] = diff;
							this.pc += 2;
							break;
						}

					case 0x000E:
						// 8xyE - SHL Vx {, Vy}
						// Set Vx = Vx SHL 1.

						// If the most-significant bit of Vx is 1, then VF is set to 1, otherwise to 0. Then Vx is multiplied by 2.
						this.V[15] = this.V[X] & 0x80;
						this.V[X] = this.V[X] << 1;
						if (this.V[X] > 255) {
							this.V[X] -= 256;
						}
						this.pc += 2;
						break;
				}
				break;

			case 0x9000:
				// 9xy0 - SNE Vx, Vy
				// Skip next instruction if Vx != Vy.
				if (this.V[X] != this.V[Y]) {
					this.pc += 2;
				}
				this.pc += 2;
				break;

			case 0xA000:
				// ANNN - LD I, addr
				// Set I = NNN.
				this.I = NNN;
				this.pc += 2;
				break;

			case 0xB000:
				// BNNN - JP V0, addr
				// Jump to location NNN + V0.
				this.pc = this.V[0] + NNN;
				break;

			case 0xC000:
				{
					// CxNN - RND Vx, byte
					// Set Vx = random byte AND NN.
					let rand = Math.floor(Math.random() * 256);
					this.V[X] = rand & NN;
					this.pc += 2;
					break;
				}

			case 0xD000:
				// Dxyn - DRW Vx, Vy, nibble
				// Display n-byte sprite starting at memory location I at (Vx, Vy), set VF = collision.

				// The interpreter reads n bytes from memory, starting at the address stored in I. These bytes are then displayed as sprites on screen at coordinates (Vx, Vy). Sprites are XORed onto the existing screen. If this causes any pixels to be erased, VF is set to 1, otherwise it is set to 0. If the sprite is positioned so part of it is outside the coordinates of the display, it wraps around to the opposite side of the screen. See instruction 8xy3 for more information on XOR, and section 2.4, Display, for more information on the Chip-8 screen and sprites.
				this.V[15] = 0;
				// Height of N pixels
				for (var i = 0; i < N; i++) {
					let sprite = leftPad(this.memory[this.I + i].toString(2), "00000000");
					let coordY = (this.V[Y] + i) % 32;
					for (var j = 0; j < 8; j++) {
						let coordX = (this.V[X] + j) % 64;
						// XOR existing and bit
						let newPixel = this.screen[coordY][coordX] ^ sprite[j];
						// Unset pixel? flag
						if (this.screen[coordY][coordX] & sprite[j]) {
							// set flag
							this.V[15] = 1;
						}
						// update screen
						this.screen[coordY][coordX] = newPixel;
						this.updatePixel(coordX, coordY, newPixel);
					}
				}
				this.pc += 2;
				break;
			case 0xE000:
				switch (this.opcode & 0x00F0) {
					case 0x0090:
						// Ex9E - SKP Vx
						// Skip next instruction if key with the value of Vx is pressed.
						if (this.keysPressed.has(this.V[X])) {
							this.pc += 2;
						}
						this.pc += 2;
						break;

					case 0x00A0:
						// ExA1 - SKNP Vx
						// Skip next instruction if key with the value of Vx is not pressed.
						if (!this.keysPressed.has(this.V[X])) {
							this.pc += 2;
						}
						this.pc += 2;
						break;
				}
				break;

			case 0xF000:
				switch (this.opcode & 0x00FF) {
					case 0x0007:
						// Fx07 - LD Vx, DT
						// Set Vx = delay timer value.
						this.V[X] = this.timers.delay;
						this.pc += 2;
						break;

					case 0x000A:
						// Fx0A - LD Vx, K
						// Wait for a key press, store the value of the key in Vx.
						if (this.keysPressed.size == 0) {
							this.waitingKey = true;
							break;
						} else {
							this.waitingKey = false;
						}
						this.V[X] = this.keysPressed.keys().next().value;
						this.pc += 2;
						break;

					case 0x0015:
						// Fx15 - LD DT, Vx
						// Set delay timer = Vx.
						this.timers.delay = this.V[X];
						this.pc += 2;
						break;

					case 0x0018:
						// Fx18 - LD ST, Vx
						// Set sound timer = Vx.
						this.timers.sound = this.V[X];
						this.pc += 2;
						break;

					case 0x001E:
						// Fx1E - ADD I, Vx
						// Set I = I + Vx.
						this.I += this.V[X];
						this.pc += 2;
						return;

					case 0x0029:
						// Fx29 - LD F, Vx
						// Set I = location of sprite for digit Vx.
						this.I = this.V[X] * 5;
						this.pc += 2;
						break;

					case 0x0033:
						{
							// Fx33 - LD B, Vx
							// Store BCD representation of Vx in memory locations I, I+1, and I+2.
							let padded = leftPad(this.V[X].toString(2), "000");
							padded.split("").forEach((digit, idx) => {
								this.memory[this.I + idx] = parseInt(digit, 10);
							});
							this.pc += 2;
							break;
						}

					case 0x0055:
						// Fx55 - LD [I], Vx
						// Store registers V0 through Vx in memory starting at location I.
						for (let i = 0; i <= X; i++) {
							this.memory[this.I + i] = this.V[i];
						}
						this.I += X + 1;
						this.pc += 2;
						break;

					case 0x0065:
						// Fx65 - LD Vx, [I]
						// Read registers V0 through Vx from memory starting at location I.
						for (let i = 0; i <= X; i++) {
							this.V[i] = this.memory[this.I + i];
						}
						this.I += X + 1;
						this.pc += 2;
						break;
				}
		}
	}

	// Screen related stuff
	initScreen() {
		this.screen = Array(32).fill();
		this.screen.forEach((row, idx) => this.screen[idx] = Array(64));
	}

	clearScreen() {
		this.initScreen();
		this.canvas.innerHTML = "";
		this.createPixels();
	}

	updatePixel(x, y, value) {
		let id = y * 64 + x;
		let pixel = this.canvas.querySelector(`#pixel-${id}`);
		pixel.classList[value ? "add" : "remove"]("black");
	}

	createPixels() {
		for (var i = 0; i < 64 * 32; i++) {
			let div = document.createElement("div");
			div.id = `pixel-${i}`;
			this.canvas.appendChild(div);
		}
	}

	// keypad
	mapKeys() {
		this.mapped = [];
	}

	initKeypad() {
		this.layout = {
			'x': { value: 0x0, position: 13 },
			'1': { value: 0x1, position: 0 },
			'2': { value: 0x2, position: 1 },
			'3': { value: 0x3, position: 2 },
			'q': { value: 0x4, position: 4 },
			'w': { value: 0x5, position: 5 },
			'e': { value: 0x6, position: 6 },
			'a': { value: 0x7, position: 8 },
			's': { value: 0x8, position: 9 },
			'd': { value: 0x9, position: 10 },
			'z': { value: 0xA, position: 12 },
			'c': { value: 0xB, position: 14 },
			'4': { value: 0xC, position: 3 },
			'r': { value: 0xD, position: 7 },
			'f': { value: 0xE, position: 11 },
			'v': { value: 0xF, position: 15 }
		};
		this.keys = document.querySelectorAll("#keypad > div");

		window.document.body.addEventListener('keydown', event => {
			let key = this.layout[event.key];
			if (!key) {
				return;
			}
			this.keysPressed.set(key.value, true);
			document.querySelector(`#key_${event.key}`).classList.add("key-pressed");
		});

		window.document.body.addEventListener('keyup', event => {
			let key = this.layout[event.key];
			if (!key) {
				return;
			}
			this.keysPressed.delete(key.value);
			document.querySelector(`#key_${event.key}`).classList.remove("key-pressed");
		});
	}
}
const emu = new CHIP8();

function loadRom(rom) {
	emu.reset();
	emu.readRom(rom);
}