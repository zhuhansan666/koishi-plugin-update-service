<template>
    <k-layout>
        <el-auto-resizer>
            <el-table :data="pluginsData" style="height: 100%;">
                <!-- <el-table-column fixed type="selection" width="55" /> -->
                <el-table-column sortable prop="name" label="目标插件" />
                <el-table-column sortable prop="metadata.time" label="注册时间" :formatter="dateFormatter"/>
                <el-table-column fixed="right" label="更新配置">
                    <template #default="value">
                        <el-tooltip content="关闭后, 注册的回调函数将不会收到新版本更新通知" placement="left-end">
                            <el-checkbox @change="(val) => { applyUpdate('allowReceiveMessage', val, value.row) }" label="允许接收新版本" :checked="value.row.metadata.config.allowReceiveMessage"/>
                        </el-tooltip>
                        <el-tooltip content="开启后, 插件可调用本服务对其自更新" placement="right-end">
                            <el-checkbox @change="(val) => { applyUpdate('allowInstall', val, value.row) }" label="允许更新" :checked="value.row.metadata.config.allowInstall"/>
                        </el-tooltip>
                    </template>
                </el-table-column>
            </el-table>
        </el-auto-resizer>
    </k-layout>
</template>

<script setup lang="ts">
import { CallbackMetadata2Client } from 'koishi-plugin-update-service'
import { useContext, store, send } from '@koishijs/client'
import { computed } from 'vue'
import { CheckboxValueType } from 'element-plus'

const pluginsData = computed(() => {
    return store.updater.data
})

const ctx = useContext()

function fillZero(num: number, length: number) {
    return num.toString().padStart(length, '0')
}

function dateFormatter(row: CallbackMetadata2Client) {
    const date = new Date(row.metadata.time)

    return `${fillZero(date.getFullYear(), 4)}-${fillZero(date.getMonth() + 1, 2)}\-${fillZero(date.getDay(), 2)} ${fillZero(date.getHours(), 2)}:${fillZero(date.getMinutes(), 2)}:${fillZero(date.getSeconds(), 2)}.${fillZero(date.getMilliseconds(), 3)}`
}

function applyUpdate(keyname: string, val: CheckboxValueType, row: CallbackMetadata2Client) {
    row.metadata.config[keyname] = Boolean(val)

    send('updater/config', row.name, row.metadata.config)
}
</script>
