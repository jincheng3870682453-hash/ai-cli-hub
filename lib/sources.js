"use strict";

/**
 * 镜像源解析：按网络区域（cn / intl）返回 npm / pip / node 下载源。
 * 国内 → 大厂/高校镜像（npmmirror、清华 TUNA）；国外 → 官方源。
 */

const NPM_REGISTRIES = {
  cn: "https://registry.npmmirror.com",
  intl: "https://registry.npmjs.org",
};

const PIP_INDEXES = {
  cn: "https://pypi.tuna.tsinghua.edu.cn/simple",
  intl: "https://pypi.org/simple",
};

/** Node 二进制镜像根（用于下载便携 Node） */
const NODE_MIRRORS = {
  cn: "https://npmmirror.com/mirrors/node",
  intl: "https://nodejs.org/dist",
};

function getNpmRegistry(region) {
  return NPM_REGISTRIES[region] || NPM_REGISTRIES.intl;
}

function getPipIndex(region) {
  return PIP_INDEXES[region] || PIP_INDEXES.intl;
}

function getNodeMirror(region) {
  return NODE_MIRRORS[region] || NODE_MIRRORS.intl;
}

function regionLabel(region) {
  if (region === "cn") return "国内";
  if (region === "intl") return "国外";
  return "未知";
}

module.exports = { getNpmRegistry, getPipIndex, getNodeMirror, regionLabel };
