import { readFile, writeFile, stat, unlink, mkdir } from "fs/promises"
import { existsSync } from 'fs'
import { parse } from 'path'

// 持久化
export class Persistencer {
    private readonly file

    constructor(file: string) {
        this.file = file
    }

    async checkFile() {
        const dirname = parse(this.file).dir
        if (!existsSync(dirname)) {
            mkdir(dirname, { recursive: true })
            return -1
        }

        const info = await stat(dirname)

        if (info.isDirectory()) {
            return 0
        }

        unlink(dirname)
        mkdir(dirname, { recursive: true })
        return -2
    }

    async save(data: object) {
        await this.checkFile()

        await writeFile(this.file, JSON.stringify(data), { encoding: 'utf-8' })
    }

    async load() {
        if (await this.checkFile() !== 0) {
            return null
        }

        return await JSON.parse(await readFile(this.file, { encoding: 'utf-8' }))
    }
}