const { v4: uuidv4 } = require('uuid');

module.exports = (sequelize, DataTypes) => {
  const JobAttendance = sequelize.define('JobAttendance', {
    id: { type: DataTypes.UUID, defaultValue: () => uuidv4(), primaryKey: true },
    jobId: { type: DataTypes.UUID, allowNull: false },
    driverId: { type: DataTypes.UUID, allowNull: false },
    date: { type: DataTypes.DATEONLY, allowNull: false },
    startTime: { type: DataTypes.DATE },
    startLat: { type: DataTypes.FLOAT },
    startLng: { type: DataTypes.FLOAT },
    startAddress: { type: DataTypes.STRING(255) },
    endTime: { type: DataTypes.DATE },
    endLat: { type: DataTypes.FLOAT },
    endLng: { type: DataTypes.FLOAT },
    endAddress: { type: DataTypes.STRING(255) },
    status: { type: DataTypes.STRING, defaultValue: 'started' },
    notes: { type: DataTypes.TEXT },
    currentLat: { type: DataTypes.FLOAT },
    currentLng: { type: DataTypes.FLOAT },
    lastPingAt: { type: DataTypes.DATE },
  }, {
    tableName: 'job_attendance',
    timestamps: true,
  });
  return JobAttendance;
};
