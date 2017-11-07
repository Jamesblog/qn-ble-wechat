//index.js
//获取应用实例
const app = getApp()

const Decoder = require('../../utils/decoder')

Page({
  data: {
    userInfo: {},
    hasUserInfo: false,
    canIUse: wx.canIUse('button.open-type.getUserInfo'),
    bleState: "空闲",
    devices: [],
  },
  decoder: null,
  //事件处理函数
  bindViewTap: function () {
    wx.navigateTo({
      url: '../logs/logs'
    })
  },
  onClickRestartScan: function (params) {
    this.setData({
      bleState: '重启扫描',
      devices: [],
    })
    this.decoder.stopScan(function () {
      console.log("停止扫描成功")

      this.decoder.startScan(function () {
        this.setData({
          bleState: "启动扫描成功",
        })
      }.bind(this))

    }.bind(this))

  },
  onClickConnect: function (params) {

    const device = params.target.dataset.id

    this.setData({
      bleState: '正在连接' + device.deviceId,
      devices: [],
    })

    this.decoder.connectDevice(device)
  },

  onScanDevice: function (device) {
    let { devices } = this.data
    devices = devices.filter(item => item.deviceId != device.deviceId)
    devices.push(device)

    devices.sort((a, b) => b.RSSI - a.RSSI)

    this.setData({
      devices: devices.slice(0, 6)
    })
  },
  onConnectStateChange: function (device, connected) {
    if (connected) {
      this.setData({
        bleState: '连接成功',
        devices: [],
      })
    } else {
      this.setData({
        bleState: '连接失败',
        devices: [],
      })

      this.decoder.startScan()
    }
  },
  onStartFetch: function (device) {
    this.setData({
      bleState: '开始请求数据',
      devices: [],
    })
  },
  onGetData: function (device, data) {
    console.log("获取到数据", data)
    this.setData({
      bleState: '请求数据成功',
    })
  },

  onLoad: function () {

    this.decoder = new Decoder(wx, this, { height: 170, gender: 1, age: 27 })

    if (app.globalData.userInfo) {
      this.setData({
        userInfo: app.globalData.userInfo,
        hasUserInfo: true
      })
    } else if (this.data.canIUse) {
      // 由于 getUserInfo 是网络请求，可能会在 Page.onLoad 之后才返回
      // 所以此处加入 callback 以防止这种情况
      app.userInfoReadyCallback = res => {
        this.setData({
          userInfo: res.userInfo,
          hasUserInfo: true
        })
      }
    } else {
      // 在没有 open-type=getUserInfo 版本的兼容处理
      wx.getUserInfo({
        success: res => {
          app.globalData.userInfo = res.userInfo
          this.setData({
            userInfo: res.userInfo,
            hasUserInfo: true
          })
        }
      })
    }
    console.log("当前data ", this.data)

    this.decoder.startScan(() => {
      this.setData({
        bleState: "启动扫描成功",
      })
    }, err => {
      this.setData({
        bleState: "启动扫描失败",
      })
      console.error(err)
    })


  },
  getUserInfo: function (e) {
    console.log(e)
    app.globalData.userInfo = e.detail.userInfo
    this.setData({
      userInfo: e.detail.userInfo,
      hasUserInfo: true
    })
  }
})
