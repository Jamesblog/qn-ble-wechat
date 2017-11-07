/**
 * Created by hdr on 17/11/2.
 */

const UUID_IBT_SERVICES = "0000FFE0-0000-1000-8000-00805F9B34FB"
const UUID_IBT_READ = "0000FFE1-0000-1000-8000-00805F9B34FB"
const UUID_IBT_WRITE = "0000FFE3-0000-1000-8000-00805F9B34FB"

const APP_ID = "123456789"
const SECRET = "25f9e794323b453885f5181f1b624d0b"
var { hexMD5 } = require('./md5');

class decoder {

  constructor(wx, listener, { height, gender, age }) {
    this.wx = wx
    this.listener = listener
    // this.onScanDevice = onScanDevice
    // this.onConnectStateChange = onConnectStateChange
    // this.onGetData = onGetData
    wx.onBluetoothDeviceFound(this.onDeviceScan.bind(this))
    wx.onBLEConnectionStateChange(this.onDeviceConnectStateChange.bind(this))
    wx.onBLECharacteristicValueChange(this.onDeviceValueChange.bind(this))
    this.bodyParams = {
      height, gender, age
    }
  }

  weightScale = 100

  device

  cmdString

  //扫描发现了设备
  onDeviceScan(deviceObj) {
    const device = deviceObj.devices[0]
    if (device.name != 'QN-Scale' || device.RSSI == 127) {
      return
    }
    const { advertisData } = device
    const advertisArrayData = new Uint8Array(advertisData)
    const advertisDataString = this.arrayToHexString(advertisArrayData)

    // console.log("扫描到设备", device, this.listener)
    if (!advertisArrayData || advertisDataString.length == 0) {
      return
    }
    let mac = ""
    const lastIndex = advertisArrayData.length - 1
    for (let i = lastIndex; i > lastIndex - 6; i--) {
      let item = advertisArrayData[i]
      if (i != lastIndex) {
        mac += ":"
      }
      let s = item.toString(16).toUpperCase()
      if (s.length == 1) {
        s += '0'
      }
      mac += s
    }

    this.listener.onScanDevice({ mac, advertisDataString, ...device })
  }

  onDeviceConnectStateChange({ deviceId, connected }) {
    if (connected) {
      
    } else {
      this.wx.closeBLEConnection({ deviceId })
    }
    this.listener.onConnectStateChange(this.device, connected)

  }

  onGetDeviceServices({ deviceId, services }) {
    console.log("获取服务成功")
    this.wx.getBLEDeviceCharacteristics({
      deviceId: this.device.deviceId,
      serviceId: UUID_IBT_SERVICES,
      success: this.onGetDeviceCharacteristics.bind(this),
      fail: err => console.error("获取特征值失败", err)
    })
  }

  onGetDeviceCharacteristics({ deviceId, serviceId, characteristics }) {
    console.log("获取特征值成功")
    this.wx.notifyBLECharacteristicValueChange({
      deviceId: this.device.deviceId,
      serviceId: UUID_IBT_SERVICES,
      characteristicId: UUID_IBT_READ,
      state: true,
      fail: err => console.error("启动通知错误", err)
    })
  }

  onDeviceValueChange({ value }) {
    const data = new Uint8Array(value);
    this.decode(data)
  }

  startScan(success, fail) {
    this.wx.openBluetoothAdapter({
      success: res => {
        this.wx.startBluetoothDevicesDiscovery({
          allowDuplicatesKey: true,
          services: ["FFE0"],
          success,
          fail,
        })
      },
      fail,
    })
  }
  stopScan(success, fail) {
    this.wx.stopBluetoothDevicesDiscovery({
      success,
      fail,
    })
  }

  connectDevice(device) {
    this.device = device

    this.wx.stopBluetoothDevicesDiscovery()
    this.wx.createBLEConnection({
      deviceId: device.deviceId,
      success: (res) => {
        console.log("連接成功", res)
        this.wx.getBLEDeviceServices({
        deviceId: this.device.deviceId,
        success: this.onGetDeviceServices.bind(this),
        fail: err => console.error("获取蓝牙服务失败", err)
      })
      }
    })
  }

  decode(data) {
    const out = {};
    const scaleType = data[2];
    const cmd = this.arrayToHexString(data)
    console.log('收到数据：', cmd)
    switch (data[0]) {
      case 0x12: {
        this.cmdString = "0x" + cmd

        this.weightScale = (data[10] & 0x01) == 1 ? 100 : 10

        const cmd = this.buildCmd(0x13, scaleType, 0x01, 0x10, 0x00, 0x00, 0x00);
        this.writeData(cmd)
        break;
      }
      case 0x10: {
        if (data[5] == 0) {
          console.log("收到不稳定数据")
        } else if (data[5] == 1) {
          console.log("收到稳定数据")
          const cmd = this.buildCmd(0x1f, scaleType, 0x10);

          this.writeData(cmd)

          const scaleString = this.cmdString + this.arrayToHexString(data)

          this.listener.onStartFetch(this.device)
          this.fetchMeasure(scaleString)
        }
        break;
      }
    }
  }

  arrayToHexString(data) {
    let str = "";

    data.forEach((item) => {
      const s = item.toString(16)
      if (s.length > 1) {
        str += s
      } else {
        str += '0' + s
      }
    });
    return str
  }

  fetchMeasure(scaleString) {
    const { height, gender, age } = this.bodyParams
    const bodyString = JSON.stringify(this.bodyParams)
    const toSignString = APP_ID + scaleString + bodyString + SECRET
    const sign = hexMD5(toSignString)
    const paramData = {
      app_id: APP_ID,
      body_params: { Body_Height: height, User_Age: age, User_Gender: gender },
      scale: scaleString,
      sign_type: "MD5",
      sign,
    }

    this.wx.request({
      url: 'http://open.yolanda.hk/open_api/calcs/qn.json',
      method: "POST",
      data: paramData,
      success: res => {
        const data = res.data.resultData
        console.log("请求成功", data)
        this.listener.onGetData(this.device, data)
      },
      fail: function (err) {
        console.log('请求失败', err)
      }
    })
  }

  buildCmd(cmd, deviceType, ...data) {
    const cmdData = [cmd, data.length + 4, deviceType];
    let checksum = 0;
    cmdData.push(...data);
    cmdData.forEach((item) => checksum += item);
    checksum = checksum & 0xFF;
    cmdData.push(checksum);

    let str = "写入数据: " + this.arrayToHexString(cmdData)

    console.log(str);

    return cmdData;

  }

  writeData(cmd) {
    const ab = new ArrayBuffer(cmd.length)
    const dv = new DataView(ab);
    cmd.forEach((value, index) => {
      dv.setUint8(index, value)
    })
    this.wx.writeBLECharacteristicValue({
      deviceId: this.device.deviceId,
      serviceId: UUID_IBT_SERVICES,
      characteristicId: UUID_IBT_WRITE,
      value: ab,
    })
  }
}

module.exports = decoder