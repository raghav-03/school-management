const express = require("express");
const router = express.Router();
const { hashSync, compareSync } = require("bcrypt");
const { UserModel } = require("../models/user");

const mongoose = require("mongoose");

const { SchoolModel } = require("../models/school");
const { BranchModel } = require("../models/branch");
const { CoordinatorModel } = require("../models/coordinator");
const { StudentModel } = require("../models/student");

const {
  authenticateRequest,
  checkUserRole,
} = require("../middleware/middleware");

router.post(
  "/schoolRegister",
  authenticateRequest,
  checkUserRole(["super-admin"]),
  (req, res) => {
    console.log("Hi, I am from school register!");

    const user = new UserModel({
      username: req.body.username,
      password: hashSync(req.body.password, 10),
      role: "school",
    });

    const school = new SchoolModel({
      name: req.body.school.name,
      image: req.body.school.image,
      isDelete: false,
    });

    user
      .save()
      .then((savedUser) => {
        school.userId = {
          id: savedUser._id,
          username: savedUser.username,
        };
        console.log(school);
        return school.save();
      })
      .then((savedSchool) => {
        res.send({
          success: true,
          message: "School created successfully",
          user: {
            id: savedSchool.userId.id,
            username: savedSchool.userId.username,
          },
          school: {
            id: savedSchool._id,
            name: savedSchool.name,
            image: savedSchool.image,
          },
        });
      })
      .catch((err) => {
        console.log(err);
        res.send({
          success: false,
          message: "Something went wrong",
          error: err,
        });
      });
  }
);

router.get(
  "/getAllSchools",
  authenticateRequest,
  checkUserRole(["super-admin"]),
  function (req, res) {
    console.log("Hi, I am from get all schools!");

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 6;

    const search = req.query.search !== "undefined" ? req.query.search : "";

    console.log("search" + search);

    const skip = (page - 1) * limit;

    let filter = { isDelete: false };

    if (search) {
      filter.$or = [{ name: { $regex: search, $options: "i" } }];
    }

    SchoolModel.find(filter)
      .select({ name: 1, _id: 1, image: 1 })
      .skip(skip)
      .limit(limit)
      .exec(function (err, schools) {
        if (err) {
          console.log(err);
          res.send({
            success: false,
            message: "Something went wrong",
            error: err,
          });
        } else {
          SchoolModel.countDocuments(filter).exec(function (err, count) {
            if (err) {
              console.log(err);
              res.send({
                success: false,
                message: "Something went wrong",
                error: err,
              });
            } else {
              const totalPages = Math.ceil(count / limit);
              res.send({
                success: true,
                message: "Schools fetched successfully",
                schools: schools,
                totalPages: totalPages,
              });
            }
          });
        }
      });
  }
);

router.put(
  "/updateSchool/:id",
  authenticateRequest,
  checkUserRole(["super-admin"]),
  function (req, res) {
    const id = mongoose.Types.ObjectId(req.params.id);
    const newName = req.body.name;

    console.log(id + newName);

    if (!newName) {
      return res.status(400).json({
        success: false,
        message: "New school name is required",
      });
    }

    mongoose.startSession().then(function (session) {
      session.startTransaction();

      Promise.all([
        SchoolModel.findOneAndUpdate(
          { _id: id },
          { name: newName },
          { new: true }
        ),

        BranchModel.updateMany({ "school.id": id }, { "school.name": newName }),

        CoordinatorModel.updateMany(
          { "school.id": id },
          { "school.name": newName }
        ),

        StudentModel.updateMany(
          { "school.id": id },
          { "school.name": newName }
        ),
      ])
        .then(function (results) {
          res.status(200).json({
            success: true,
            message: "School and related models updated successfully",
            results: results,
          });
          session.commitTransaction();
          session.endSession();
        })
        .catch(function (error) {
          session.abortTransaction();
          res.status(500).json({
            success: false,
            message: "Error updating school and related models",
            error: error,
          });
          session.endSession();
        });
    });
  }
);

router.put(
  "/deleteSchool/:id",
  authenticateRequest,
  checkUserRole(["super-admin"]),
  (req, res) => {
    const id = req.params.id;

    console.log("Hi iam from delete school api");
    console.log(id);

    SchoolModel.findById(id)
      .then((school) => {
        if (!school) {
          return res.status(404).json({
            success: false,
            message: "School not found",
          });
        }

        school.isDelete = true;

        school.updatedAt = Date.now();

        school
          .save()
          .then((updatedSchool) => {
            return res.status(200).json({
              success: true,
              message: "School updated successfully",
              school: updatedSchool,
            });
          })
          .catch((err) => {
            return res.status(500).json({
              success: false,
              message: "Error updating school",
              error: err,
            });
          });
      })
      .catch((err) => {
        return res.status(500).json({
          success: false,
          message: "Error updating school",
          error: err,
        });
      });
  }
);

//STATS ROUTES
router.get(
  "/total",
  authenticateRequest,
  checkUserRole(["super-admin"]),
  function (req, res) {
    var schoolCount, branchCount, coordinatorCount, studentCount;

    SchoolModel.aggregate(
      [
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
          },
        },
      ],
      function (err, result) {
        if (err) throw err;
        schoolCount = result[0].count;
        BranchModel.aggregate(
          [
            {
              $group: {
                _id: null,
                count: { $sum: 1 },
              },
            },
          ],
          function (err, result) {
            if (err) throw err;
            branchCount = result[0].count;
            CoordinatorModel.aggregate(
              [
                {
                  $group: {
                    _id: null,
                    count: { $sum: 1 },
                  },
                },
              ],
              function (err, result) {
                if (err) throw err;
                coordinatorCount = result[0].count;
                StudentModel.aggregate(
                  [
                    {
                      $group: {
                        _id: null,
                        count: { $sum: 1 },
                      },
                    },
                  ],
                  function (err, result) {
                    if (err) throw err;
                    studentCount = result[0].count;
                    res.json({
                      totalSchools: schoolCount,
                      totalBranches: branchCount,
                      totalCoordinators: coordinatorCount,
                      totalStudents: studentCount,
                    });
                  }
                );
              }
            );
          }
        );
      }
    );
  }
);

router.get(
  "/latest",
  authenticateRequest,
  checkUserRole(["super-admin"]),
  function (req, res) {
    var latestSchool, latestBranch, latestCoordinator, latestStudent;
    SchoolModel.aggregate(
      [
        { $sort: { createdAt: -1 } },
        { $group: { _id: null, latest: { $first: "$$ROOT" } } },
        {
          $project: {
            _id: 0,
            name: "$latest.name",
            createdAt: "$latest.createdAt",
          },
        },
      ],
      function (err, result) {
        if (err) throw err;
        latestSchool = result;
        BranchModel.aggregate(
          [
            { $sort: { createdAt: -1 } },
            { $group: { _id: null, latest: { $first: "$$ROOT" } } },
            {
              $project: {
                _id: 0,
                location: "$latest.location",
                schoolName: "$latest.school.name",
                createdAt: "$latest.createdAt",
              },
            },
          ],
          function (err, result) {
            if (err) throw err;
            latestBranch = result;
            CoordinatorModel.aggregate(
              [
                { $sort: { createdAt: -1 } },
                { $group: { _id: null, latest: { $first: "$$ROOT" } } },
                {
                  $project: {
                    _id: 0,
                    name: "$latest.name",
                    schoolName: "$latest.school.name",
                    branchLocation: "$latest.branch.location",
                    createdAt: "$latest.createdAt",
                  },
                },
              ],
              function (err, result) {
                if (err) throw err;
                latestCoordinator = result;
                StudentModel.aggregate(
                  [
                    { $sort: { createdAt: -1 } },
                    { $group: { _id: null, latest: { $first: "$$ROOT" } } },
                    {
                      $project: {
                        _id: 0,
                        name: "$latest.name",
                        schoolName: "$latest.school.name",
                        branchLocation: "$latest.branch.location",
                        coordinatorName: "$latest.coordinator.name",
                        createdAt: "$latest.createdAt",
                      },
                    },
                  ],
                  function (err, result) {
                    if (err) throw err;
                    latestStudent = result;
                    res.json({
                      latestSchool: latestSchool,
                      latestBranch: latestBranch,
                      latestCoordinator: latestCoordinator,
                      latestStudent: latestStudent,
                    });
                  }
                );
              }
            );
          }
        );
      }
    );
  }
);

router.get(
  "/activeInactiveSchools",
  authenticateRequest,
  checkUserRole(["super-admin"]),
  function (req, res) {
    var activeCount, inactiveCount;
    SchoolModel.aggregate(
      [
        {
          $group: {
            _id: "$isDelete",
            count: { $sum: 1 },
          },
        },
      ],
      function (err, result) {
        if (err) throw err;
        result.forEach((item) => {
          if (item._id === "false") {
            activeCount = item.count;
          } else if (item._id === "true") {
            inactiveCount = item.count;
          }
        });
        res.json({
          activeSchools: activeCount,
          inactiveSchools: inactiveCount,
        });
      }
    );
  }
);

router.get(
  "/schoolRegistrationsOverPeriodOfTime",
  authenticateRequest,
  checkUserRole(["super-admin"]),
  function (req, res) {
    var startDate = new Date("2023-02-01T00:00:00.000Z");
    var endDate = new Date();

    SchoolModel.aggregate(
      [
        {
          $match: {
            createdAt: {
              $gte: startDate,
              $lte: endDate,
            },
          },
        },
        {
          $group: {
            _id: {
              $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
            },
            count: { $sum: 1 },
          },
        },
        {
          $sort: { _id: 1 },
        },
      ],
      function (err, result) {
        if (err) throw err;
        var dates = [],
          counts = [];
        result.forEach((item) => {
          dates.push(item._id);
          counts.push(item.count);
        });
        res.json({
          dates: dates,
          counts: counts,
        });
      }
    );
  }
);

module.exports = router;
