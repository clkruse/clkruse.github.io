import json
import numpy as np
import matplotlib.pyplot as plt
import os


counter = 0
y_pos = []
for file in sorted(os.listdir('json')):
    counter += 1
    f = open(os.path.join('json', file))
    data = json.load(f)

    keypoints = np.array(data[0]['keypoints'])

    x = keypoints[0::3]
    y = 1080 - keypoints[1::3]
    y_pos.append(y[16])
    if counter % 30 == 0:
        plt.scatter(x,y, s=1)
        plt.scatter(x[16],y[16], s=1)
        plt.xlim([0, 1920])
        plt.ylim([0, 1080])
        plt.show()

filtered_y = []


fb_data = np.load('alden_basketball_1.npy')
from mpl_toolkits.mplot3d import Axes3D

for frame in fb_data[0::20]:
    z = frame[:,0]
    y = -frame[:,1]
    x = frame[:,2]
    fig = plt.figure()
    ax = fig.add_subplot(111, projection='3d')
    #ax = fig.add_subplot(111)
    ax.scatter(x,y,z)
    ax.set_xlim([-1, 1])
    ax.set_ylim([-1, 1])
    ax.set_zlim([-1, 1])
    ax.set_xlabel('x')
    ax.set_ylabel('y')
    ax.set_zlabel('z')
    #ax.scatter(x[3],y[3],z[3])
    plt.show()


for frame in fb_data[0::20]:
    x = frame[:,0]
    y = -frame[:,1]
    fig = plt.figure()
    #ax = fig.add_subplot(111, projection='3d')
    ax = fig.add_subplot(111)
    ax.scatter(x,y)
    ax.set_xlim([-1, 1])
    ax.set_ylim([-1, 1])
    ax.set_xlabel('x')
    ax.set_ylabel('y')
    #ax.scatter(x[3],y[3],z[3])
    plt.show()




for joint in range(17):
    fig = plt.figure()
    ax = fig.add_subplot(111, projection='3d')
    ax.scatter(x,y,z)
    ax.scatter(x[joint],y[joint],z[joint], c='r', s=25)
    plt.xlim([-1, 1])
    plt.ylim([-1, 1])
    plt.xlabel('x')
    plt.ylabel('y')
    plt.title(joint)
    plt.show()


from scipy.signal import savgol_filter
from scipy import fftpack

def get_frequency(x, title):
    x_filtered = savgol_filter(x, 11, 3)
    fourier = fftpack.fft(x_filtered)
    freqs = fftpack.fftfreq(len(x)) * 240

    steps_per_min = int(np.max(np.abs(freqs[np.argsort(np.abs(fourier))[-4:]] * 60)))

    plt.figure(figsize=(12,6))
    plt.subplot(1,2,1)
    plt.stem(freqs, np.abs(fourier))
    plt.xlabel('Frequency in Hertz [Hz]')
    plt.ylabel('Freq Magnitude')
    plt.xlim(0.3, 4)
    plt.ylim(0, 80)
    plt.title("Frequency: {:0.1f} Hz".format(np.max(np.abs(freqs[np.argsort(np.abs(fourier))[-5:]]))))
    plt.subplot(1,2,2)
    plt.plot(x_filtered)
    plt.xlabel('Position per Frame')
    plt.title("Cadence: {0} steps per minute".format(2 * steps_per_min))
    plt.suptitle(title)
    plt.savefig(title + '.png')
    plt.show()


data = np.load('alden_basketball_1.npy')
right_foot = data[:,3,:]
left_foot = data[:,6,:]
get_frequency(left_foot[:,0], 'Left Foot X - Alden Jog')
get_frequency(left_foot[:,1], 'Left Foot Y - Alden Sprint')
get_frequency(left_foot[:,2], 'Left Foot Z - Alden Sprint')

get_frequency(right_foot[:,0], 'Right Foot X - Alden Jog')
get_frequency(right_foot[:,1], 'Right Foot Y - Alden Sprint')
get_frequency(right_foot[:,2], 'Right Foot Z - Alden Sprint')

data = np.load('alden_sprint_basketball.npy')
right_foot = data[:,3,0]
plt.figure(figsize=(8,6))
plt.plot(np.linspace(0,len(right_foot)/240,len(right_foot)), right_foot, linewidth=1)
plt.title('Right Foot')
left_foot = data[:,6,0]
plt.plot(np.linspace(0,len(right_foot)/240,len(right_foot)), left_foot, c='r', linewidth=1)
plt.title('Foot Position (X) - Alden Sprint')
plt.legend(['Right', 'Left'])
plt.xlabel('Time (seconds)')
plt.savefig('Foot Position (X) - Alden Sprint.png')
plt.show()




data = np.load('alden_basketball_1.npy')

right_foot_x = data[:,3,0]
right_foot_y =  -data[:,3,1]
right_foot_z =  -data[:,3,2]

center_x = data[:,1,0]
center_y =  - data[:,1,1]
center_y =  - data[:,1,2]


right_foot_y_filtered = savgol_filter(right_foot_y, 51, 3)
d_right_foot_y = right_foot_y_filtered[1:] - right_foot_y_filtered[0:-1]
d_filtered = savgol_filter(d_right_foot_y, 31, 3)
plt.plot(right_foot_y_filtered)
plt.plot(10 * (d_filtered))
plt.grid()
plt.legend(['Y Position', 'dY Position'])
plt.title('Smoothed Y Position and Derivative')
plt.show()


for i in range(0,500,5):
    plt.scatter(center_x[i], center_y[i])
    plt.scatter(0, right_foot_y[i])
    plt.xlim([-1, 1])
    plt.ylim([-1, 1])
    plt.grid()
    plt.show()



left_foot_x = data[:,6,0]
left_foot_y =  - data[:,6,1]

center_x = data[:,2,0]
center_y =  - data[:,2,1]


diff_right_x = center_x - right_foot_x
diff_right_y = center_y - right_foot_y

plt.scatter(right_foot_x, right_foot_y, s=4, c=range(len(left_foot_x)))
plt.scatter(center_x, center_y, s=4, c=range(len(left_foot_x)))
plt.plot(right_foot_x, right_foot_y, c='k', linewidth=.1)
plt.colorbar()
plt.show()

plt.scatter(left_foot_x, left_foot_y, s=4, c=range(len(left_foot_x)))
plt.scatter(center_x, center_y, s=4, c=range(len(left_foot_x)))
plt.plot(left_foot_x, left_foot_y, c='k', linewidth=.1)
plt.colorbar()
plt.show()

plt.scatter(diff_right_x, diff_right_y, s=4, c=range(len(left_foot_x)))
#plt.scatter(center_x, center_y, s=4, c=range(len(left_foot_x)))
plt.colorbar()
plt.show()
