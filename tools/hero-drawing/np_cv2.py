"""NumPy/SciPy stand-ins for the OpenCV calls that prepare the tracing channels.

trace_lines.py (and chains.py) import OpenCV when it is installed. Without it they fall back
to this module, which re-implements exactly the three calls used by trace_lines.load_channels():

  bilateralFilter(img, d, sigmaColor, sigmaSpace)   8-bit, 3 channels, BORDER_REFLECT_101
  cvtColor(img, COLOR_BGR2LAB)                       float32 BGR in 0..1 -> L 0..100, a, b (sRGB, D65)
  GaussianBlur(img, (0, 0), sigma)                   float32, auto kernel size, BORDER_REFLECT_101

They follow OpenCV's own definitions (circular d x d window, L1 colour distance summed over the
channels, colour weight exp(-dist^2 / (2 sigmaColor^2)), space weight exp(-r^2 / (2 sigmaSpace^2)),
result rounded to uint8; sRGB gamma then XYZ (D65) then CIE Lab; Gaussian kernel of
round(8 sigma + 1) | 1 taps). Re-tracing the 27 guides of 2026-10-27 with this module
reproduces 21 strokes byte for byte and the other 6 within 0.2 source px (README.md).
Everything else OpenCV offers (fitEllipse, drawing, CLAHE, Canny) is not provided: the debug
overlays, chain detection and chains.py --overlay still need OpenCV.
"""
import numpy as np
from scipy.ndimage import gaussian_filter

COLOR_BGR2LAB = 44  # same value as cv2.COLOR_BGR2LAB


def _shift(padded, dy, dx, r, h, w):
    return padded[r + dy: r + dy + h, r + dx: r + dx + w]


def bilateralFilter(img, d, sigmaColor, sigmaSpace):
    src = np.asarray(img)
    if src.dtype != np.uint8 or src.ndim != 3:
        raise NotImplementedError("np_cv2.bilateralFilter supports 8-bit multi-channel images only")
    h, w, cn = src.shape
    r = d // 2
    color_w = np.exp(np.arange(256 * cn, dtype=np.float64) ** 2 * (-0.5 / (sigmaColor * sigmaColor))).astype(np.float32)
    pad = np.pad(src, ((r, r), (r, r), (0, 0)), mode="reflect").astype(np.int32)  # reflect = REFLECT_101
    centre = src.astype(np.int32)
    acc = np.zeros((h, w, cn), np.float32)
    wsum = np.zeros((h, w), np.float32)
    for i in range(-r, r + 1):
        for j in range(-r, r + 1):
            rr = np.sqrt(i * i + j * j)
            if rr > r:
                continue
            sw = np.float32(np.exp(rr * rr * (-0.5 / (sigmaSpace * sigmaSpace))))
            nb = _shift(pad, i, j, r, h, w)
            dist = np.abs(nb - centre).sum(axis=2)
            wgt = sw * color_w[dist]
            acc += nb.astype(np.float32) * wgt[:, :, None]
            wsum += wgt
    out = acc / wsum[:, :, None]
    return np.clip(np.rint(out), 0, 255).astype(np.uint8)


def cvtColor(img, code):
    if code != COLOR_BGR2LAB:
        raise NotImplementedError("np_cv2.cvtColor supports COLOR_BGR2LAB only")
    f = np.asarray(img, np.float32)
    b, g, rch = f[:, :, 0], f[:, :, 1], f[:, :, 2]
    def lin(v):
        return np.where(v <= 0.04045, v / 12.92, ((v + 0.055) / 1.055) ** 2.4)
    R, G, B = lin(rch), lin(g), lin(b)
    X = (0.412453 * R + 0.357580 * G + 0.180423 * B) / 0.950456
    Y = 0.212671 * R + 0.715160 * G + 0.072169 * B
    Z = (0.019334 * R + 0.119193 * G + 0.950227 * B) / 1.088754
    def fn(t):
        return np.where(t > 0.008856, np.cbrt(t), 7.787 * t + 16.0 / 116.0)
    fx, fy, fz = fn(X), fn(Y), fn(Z)
    L = np.where(Y > 0.008856, 116.0 * fy - 16.0, 903.3 * Y)
    a = 500.0 * (fx - fy)
    bb = 200.0 * (fy - fz)
    return np.stack([L, a, bb], axis=2).astype(np.float32)


def GaussianBlur(img, ksize, sigma):
    if tuple(ksize) != (0, 0):
        raise NotImplementedError("np_cv2.GaussianBlur supports ksize (0, 0) only")
    src = np.asarray(img, np.float32)
    k = int(round(sigma * 4 * 2 + 1)) | 1          # OpenCV's size for float images
    radius = (k - 1) // 2
    return gaussian_filter(src, sigma, mode="mirror", truncate=radius / sigma).astype(np.float32)
