const font = [
	//"0"
	["11110000", "10010000", "10010000", "10010000", "11110000"],
	//"1"
	["00100000", "01100000", "00100000", "00100000", "01110000"],
	//"2"
	["11110000", "00010000", "11110000", "10000000", "11110000"],
	//"3"
	["11110000", "00010000", "11110000", "00010000", "11110000"],
	//"4"
	["10010000", "10010000", "11110000", "00010000", "00010000"],
	//"5"
	["11110000", "10000000", "11110000", "00010000", "11110000"],
	//"6"
	["11110000", "10000000", "11110000", "10010000", "11110000"],
	//"7"
	["11110000", "00010000", "00100000", "01000000", "01000000"],
	//"8"
	["11110000", "10010000", "11110000", "10010000", "11110000"],
	//"9"
	["11110000", "10010000", "11110000", "00010000", "11110000"],
	//"A"
	["11110000", "10010000", "11110000", "10010000", "10010000"],
	//"B"
	["11100000", "10010000", "11100000", "10010000", "11100000"],
	//"C"
	["11110000", "10000000", "10000000", "10000000", "11110000"],
	//"D"
	["11100000", "10010000", "10010000", "10010000", "11100000"],
	//"E"
	["11110000", "10000000", "11110000", "10000000", "11110000"],
	//"F"
	["11110000", "10000000", "11110000", "10000000", "10000000"]
];

const leftPad = (string, pad) => pad.substring(0, pad.length - string.length) + string;

var steps = 10;

class CHIP8 {
	constructor() {
		this.canvas = document.querySelector("#canvas");
		this.callStack = document.querySelector("#stack");
		this.reset();
		this.animationFrameRequest = null;
	}

	reset() {
		this.memory = new Uint8Array(4096);
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
		this.keyPressed = null;
		this.initFont();
		this.pc = 0x0200;
		window.cancelAnimationFrame(this.animationFrameRequest);
	}

	initFont() {
		this.pc = 0;
		font.forEach(letter => {
			letter.forEach(byte => {
				this.memory[this.pc] = parseInt(byte, 2);
				this.pc += 0x01;
			});
		});
	}

	async readRom (rom) {
		rom = await fetch(`./roms/${rom}`);
		rom = await rom.arrayBuffer();
		rom = new Uint8Array(rom);
		rom.forEach(byte => {
			this.memory[this.pc] = byte;
			this.pc++;
		});
		this.pc = 0x0200;
		this.loop();
	}

	readOpcode() {
		this.opcode = this.memory[this.pc] << 8 | this.memory[this.pc + 1];
	}

	loop() {
		this.readOpcode();
		this.executeCode();
		this.displayCode();
		this.timers.delay = Math.max(this.timers.delay - 1, 0);
		this.timers.sound = Math.max(this.timers.sound - 1, 0);

		if (steps-- == 0) {
			steps = 10;
			this.animationFrameRequest = window.requestAnimationFrame(this.loop.bind(this));
		} else {
			this.loop();
		}
	}

	displayCode() {
		console.log(`${this.opcode.toString(16)} - ${this.debug}`);
		this.debug = "";
	}

	executeCode() {
		let NNN = 0x0FFF & this.opcode;
		let NN = 0x00FF & this.opcode;
		let N = 0x000F & this.opcode;
		let X = (0x0F00 & this.opcode) >> 8;
		let Y = (0x00F0 & this.opcode) >> 4;
		let B = 0xF000 & this.opcode;

		switch(B) {

		case 0x0000:
			if (this.opcode === 0x00E0) {
				this.clearScreen();
				this.debug = "Clear screen";
				this.pc += 2;
			}
			if (this.opcode === 0x00EE) {
				this.pc = this.stack.pop();
				this.debug = "Exit subroutine";
			}
			break;

		case 0x1000:
			//Jumps to address NNN.
			this.pc = NNN;
			this.debug = `Jump to NNN (${NNN})`;
			break;

		case 0x2000:
			//2NNN Calls subroutine at NNN.
			this.stack.push(this.pc + 2);
			this.pc = NNN;
			this.debug = `Run subroutine at NNN (${NNN})`;
			break;

		case 0x3000:
		case 0x4000:
			// 3XNN Cond 	if(Vx==NN) 	Skips the next instruction if VX equals NN. (Usually the next instruction is a jump to skip a code block)
			// 4XNN 	Cond 	if(Vx!=NN) 	Skips the next instruction if VX doesn't equal NN. (Usually the next instruction is a jump to skip a code block)
			this.debug = `Skip next if V[X] (V[${X}] ${B == 0x4000 ? "!=" : "=="} ${this.V[X]}) == NN (${NN})`;
			if ((B === 0x3000) == (this.V[X] == NN)) {
				this.debug += " -- Skipped";
				this.pc += 2;
			}
			this.pc += 2;
			break;

		case 0x5000:
			// 5XY0 	Cond 	if(Vx==Vy) 	Skips the next instruction if VX equals VY. (Usually the next instruction is a jump to skip a code block)
			if (this.V[X] == this.V[Y]) {
				this.debug = `Skip next because V[${X}] == V[${Y}]`;
				this.pc += 2;
			}
			this.pc += 2;
			break;

		case 0x6000:
			// 6XNN 	Const 	Vx = NN 	Sets VX to NN.
			this.V[X] = NN;
			this.debug = `Set V[${X}] to  NN (${NN})`;
			this.pc += 2;
			break;

		case 0x7000:
			// 7XNN 	Const 	Vx += NN 	Adds NN to VX. (Carry flag is not changed)
			this.V[X] += NN;
			this.debug = `Add NN (${NN}) to V[${X}]`;
			this.pc += 2;
			break;

		case 0x8000:
			switch (0x000F & this.opcode) {
			case 0x0000:
				// 8XY0 	Assign 	Vx=Vy 	Sets VX to the value of VY.
				this.V[X] = this.V[Y];
				this.debug = `Sets V[${X}] to V[${Y}]`;
				this.pc += 2;
				break;

			case 0x0001:
				// 8XY1 	BitOp 	Vx=Vx|Vy 	Sets VX to VX or VY. (Bitwise OR operation)
				this.V[X] = this.V[X] | this.V[Y];
				this.debug = `Sets V[${X}] to V[${X}] | V[${Y}]`;
				this.pc += 2;
				break;

			case 0x0002:
				// 8XY2 	BitOp 	Vx=Vx&Vy 	Sets VX to VX and VY. (Bitwise AND operation)
				this.V[X] = this.V[X] & this.V[Y];
				this.debug = `Sets V[${X}] to V[${X}] & V[${Y}]`;
				this.pc += 2;
				break;

			case 0x0003:
				// 8XY3 	BitOp 	Vx=Vx^Vy 	Sets VX to VX xor VY.
				this.V[X] = this.V[X] ^ this.V[Y];
				this.debug = `Sets V[${X}] to V[${X}] ^ V[${Y}]`;
				this.pc += 2;
				break;

			case 0x0004: {
				// 8XY4 	Math 	Vx += Vy 	Adds VY to VX. VF is set to 1 when there's a carry, and to 0 when there isn't.
				let sum = this.V[X] + this.V[Y];
				this.debug = `Sets V[X] to V[X] + V[Y] (V[${X}] = V[${X}] + V[${Y}] = ${this.V[X] + this.V[Y]} = ${sum % 256}`;
				this.V[15] = 0;
				if (sum > 256) {
					this.V[15] = 1;
					sum = sum % 256;
				}
				this.debug += ` - V[F] set to ${this.V[15]}`;
				this.V[X] = sum;
				this.pc += 2;
				break;
			}

			case 0x0005: {
				// 8XY5 	Math 	Vx -= Vy 	VY is subtracted from VX. VF is set to 0 when there's a borrow, and 1 when there isn't.
				let diff = this.V[X] - this.V[Y];
				this.V[15] = 1;
				if (diff < 0) {
					this.V[15] = 0;
					diff += 256;
				}
				this.V[X] = diff;
				this.debug = `Sets V[${X}] to V[${X}] ^ V[${Y}]`;
				this.pc += 2;
				break;
			}

			case 0x0006:
				// 8XY6 	BitOp 	Vx=Vy=Vy>>1 	Shifts VY right by one and copies the result to VX. VF is set to the value of the least significant bit of VY before the shift.[2]
				this.V[15] = this.V[Y] & 0x01;
				this.V[X] = this.V[Y] >> 1;
				this.pc += 2;
				break;

			case 0x0007: {
				// 8XY7 	Math 	Vx=Vy-Vx 	Sets VX to VY minus VX. VF is set to 0 when there's a borrow, and 1 when there isn't.
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
				// 8XYE 	BitOp 	Vx=Vy=Vy<<1 	Shifts VY left by one and copies the result to VX. VF is set to the value of the most significant bit of VY before the shift.[2]
				this.V[15] = (this.V[Y] & 0x80) >> 7;
				this.V[X] = this.V[Y] << 1;
				this.pc += 2;
				break;
			}
			break;

		case 0x9000:
			// 9XY0 	Cond 	if(Vx!=Vy) 	Skips the next instruction if VX doesn't equal VY. (Usually the next instruction is a jump to skip a code block)
			if (this.V[X] != this.V[Y]) {
				this.pc += 2;
			}
			this.pc += 2;
			break;

		case 0xA000:
			// ANNN 	MEM 	I = NNN 	Sets I to the address NNN.
			this.I = NNN;
			this.debug = `Set I to NNN (${NNN})`;
			this.pc += 2;
			break;

		case 0xB000:
			// BNNN 	Flow 	PC=V0+NNN 	Jumps to the address NNN plus V0.
			this.pc = this.V[0] + NNN;
			this.debug = `Jump to V[0] (${this.V[0]}) + NNN (${NNN}) = ${this.V[0] + NNN}`;
			break;

		case 0xC000: {
			// CXNN 	Rand 	Vx=rand()&NN 	Sets VX to the result of a bitwise and operation on a random number (Typically: 0 to 255) and NN.
			let rand = Math.floor(Math.random() * 256);
			this.V[X] = rand & NN;
			this.debug = `Set V[${X}] to rand (${rand}) & NN (${NN}) = (${this.V[X]})`;
			this.pc += 2;
			break;
		}

		case 0xD000:
			// DXYN 	Disp 	draw(Vx,Vy,N) 	Draws a sprite at coordinate (VX, VY) that has a width of 8 pixels and a height of N pixels. Each row of 8 pixels is read as bit-coded starting from memory location I; I value doesn’t change after the execution of this instruction. As described above, VF is set to 1 if any screen pixels are flipped from set to unset when the sprite is drawn, and to 0 if that doesn’t happen
			// ---
			// Display n-byte sprite starting at memory location I at (Vx, Vy), set VF = collision.

			// The interpreter reads n bytes from memory, starting at the address stored in I. These bytes are then displayed as sprites on screen at coordinates (Vx, Vy). Sprites are XORed onto the existing screen. If this causes any pixels to be erased, VF is set to 1, otherwise it is set to 0. If the sprite is positioned so part of it is outside the coordinates of the display, it wraps around to the opposite side of the screen.
			this.V[15] = 0;
			// Height of N pixels
			this.debug = "";
			for (var i = 0; i < N; i++) {
				let sprite = leftPad(this.memory[this.I + i].toString(2), "00000000");
				this.debug += `Draw ${sprite} at V[${X}] (${this.V[X] % 64}), V[${Y}] (${this.V[Y] % 32})\n`;
				for (var j = 0; j < 8; j++) {
					let coordX = (this.V[X] + j) % 64;
					let coordY = (this.V[Y] + i) % 32;
					// XOR existing and bit
					let newPixel = this.screen[coordY][coordX] ^ sprite[j];
					if (newPixel == 0) {
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
			case 0x00E0:
				// EX9E 	KeyOp 	if(key()==Vx) 	Skips the next instruction if the key stored in VX is pressed. (Usually the next instruction is a jump to skip a code block)
				if (this.keyPressed === this.V[X]) {
					this.pc += 2;
				}
				this.pc += 2;
				break;

			case 0x00A0:
				// EXA1 	KeyOp 	if(key()!=Vx) 	Skips the next instruction if the key stored in VX isn't pressed. (Usually the next instruction is a jump to skip a code block)
				if (this.keyPressed !== this.V[X]) {
					this.pc += 2;
				}
				this.pc += 2;
				break;
			}
			break;

		case 0xF000:
			switch (this.opcode & 0x00FF) {
			case 0x0007:
				// FX07 	Timer 	Vx = get_delay() 	Sets VX to the value of the delay timer.
				this.V[X] = this.timers.delay;
				this.debug = `Sets V[${X}] to delay timer (${this.timers.delay})`;
				this.pc += 2;
				break;

			case 0x000A:
				// FX0A 	KeyOp 	Vx = get_key() 	A key press is awaited, and then stored in VX. (Blocking Operation. All instruction halted until next key event)
				this.waitKey();
				this.V[X] =  this.keyPressed;
				this.debug = `Sets V[${X}] to keyPressed (${this.keyPressed})`;
				this.pc += 2;
				break;

			case 0x0015:
				// FX15 	Timer 	delay_timer(Vx) 	Sets the delay timer to VX.
				this.timers.delay = this.V[X];
				this.debug = `Set delay timer to V[X] (V[${X}] = ${this.V[X]})`;
				this.pc += 2;
				break;

			case 0x0018:
				// FX18 	Sound 	sound_timer(Vx) 	Sets the sound timer to VX.
				this.timers.sound = this.V[X];
				this.pc += 2;
				break;

			case 0x001E:
				// FX1E 	MEM 	I +=Vx 	Adds VX to I.[3]
				this.I += this.V[X];
				this.pc += 2;
				return;

			case 0x0029:
				// FX29 	MEM 	I=sprite_addr[Vx] 	Sets I to the location of the sprite for the character in VX. Characters 0-F (in hexadecimal) are represented by a 4x5 font.
				this.debug = `Set I to font char V[X] (V[${X}] = ${this.V[X]}`;
				this.I = this.V[X] * 5;
				this.pc += 2;
				break;

			case 0x0033: {
				// FX33 	BCD 	set_BCD(Vx); *(I+0)=BCD(3);*(I+1)=BCD(2);*(I+2)=BCD(1); Stores the binary-coded decimal representation of VX, with the most significant of three digits at the address in I, the middle digit at I plus 1, and the least significant digit at I plus 2. (In other words, take the decimal representation of VX, place the hundreds digit in memory at location in I, the tens digit at location I+1, and the ones digit at location I+2.)
				this.debug = `Set V[X] (V[${X}] = ${this.V[X]}) as BCD to I (${this.I}})`;
				let padded = leftPad(this.V[X].toString(2), "000");
				padded.split("").forEach((digit, idx) => {
					this.memory[this.I + idx] = parseInt(digit, 10);
				});
				this.pc += 2;
				break;
			}

			case 0x0055:
				// FX55 	MEM 	reg_dump(Vx,&I) 	Stores V0 to VX (including VX) in memory starting at address I. I is increased by 1 for each value written.
				this.debug = `Dump to I (${this.I}) from V[0]-V[${X}]`;
				for (let i = 0; i <= X; i++) {
					this.memory[this.I + i] = this.V[i];
					this.debug += `\n V[${i}] = ${this.memory[this.I + i]}`;
				}
				this.I += X + 1;
				this.pc += 2;
				break;

			case 0x0065:
				// FX65 	MEM 	reg_load(Vx,&I) 	Fills V0 to VX (including VX) with values from memory starting at address I. I is increased by 1 for each value written.
				this.debug = `Load from I (${this.I}) to V[0]-V[${X}]`;
				for (let i = 0; i <= X; i++) {
					this.V[i] = this.memory[this.I + i];
					this.debug += `\n V[${i}] = ${this.memory[this.I + i]}`;
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
}
const emu = new CHIP8();

function loadRom(rom) {
	emu.reset();
	emu.readRom(rom);
}