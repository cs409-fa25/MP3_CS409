/*
 * Connect all of your endpoints together here.
 */

module.exports = function (app, router) {
  const mongoose = require("mongoose");

  require("../models/User");
  require("../models/Task");

  const User = mongoose.model("User");
  const Task = mongoose.model("Task");

  const ok = (res, data, message = "OK", status = 200) =>
    res.status(status).json({ message, data });
  const error = (res, status, message, data = null) =>
    res.status(status).json({ message, data });


router.get("/users", async (req, res) => {
  const ok = (data, message = "OK", status = 200) =>
    res.status(status).json({ message, data });
  const error = (status, message, data = null) =>
    res.status(status).json({ message, data });

  const parseJSON = (str) => {
    if (typeof str !== "string") return null;
    try { return JSON.parse(str); } catch { return null; }
  };

  try {

    const where  = parseJSON(req.query.where)  || {};
    const sort   = parseJSON(req.query.sort)   || null;
    const select = parseJSON(req.query.select) || null;

    let skip = Number.isFinite(+req.query.skip) ? +req.query.skip : 0;
    let limit = Number.isFinite(+req.query.limit) ? +req.query.limit : undefined;

    const count = String(req.query.count).toLowerCase() === "true";

    let q = mongoose.model("User").find(where);
    if (sort)   q = q.sort(sort);
    if (select) q = q.select(select);
    if (skip)   q = q.skip(skip);
    if (limit !== undefined) q = q.limit(limit);

    if (count) {
      const c = await mongoose.model("User").countDocuments(where);
      return ok(c);
    }

    const users = await q.exec();
    return ok(users);
  } catch (e) {
    return error(400, "Invalid query parameters");
  }
});

  router.post("/users", async (req, res) => {
    try {
      const { name, email, pendingTasks } = req.body || {};
      if (!name || !email) {
        return error(res, 400, "Name and email are required");
      }
      const user = await User.create({
        name: String(name).trim(),
        email: String(email).toLowerCase().trim(),
        pendingTasks: Array.isArray(pendingTasks) ? pendingTasks : [],
      });

      ok(res, user, "Created", 201);
    } catch (err) {
      if (err && err.code === 11000) {
        return error(res, 400, "A user with that email already exists");
      }
      error(res, 500, "Server error");
    }
  });

router.get("/tasks", async (req, res) => {
  const ok = (data, message = "OK", status = 200) =>
    res.status(status).json({ message, data });
  const error = (status, message, data = null) =>
    res.status(status).json({ message, data });
  const parseJSON = (s) => {
    if (typeof s !== "string") return null;
    try { return JSON.parse(s); } catch { return null; }
  };

const parseQueryParam = (val) => {
  if (val == null) return null;
  if (typeof val === "object") return val;          
  if (typeof val === "string") {
    try { return JSON.parse(val); } catch (_) {}
    try { return JSON.parse(val.replace(/'/g, '"')); } catch (_) {}
  }
  return null;
};

try {
  const where  = parseQueryParam(req.query.where)  || {};
  const sort   = parseQueryParam(req.query.sort)   || null;
  const select = parseQueryParam(req.query.select) || null;

  const skip   = Number.isFinite(+req.query.skip) ? +req.query.skip : 0;

  const hasLimit = req.query.limit !== undefined;
  const limit = hasLimit
    ? (Number.isFinite(+req.query.limit) ? +req.query.limit : 100)
    : 100;

  const wantCount = String(req.query.count).toLowerCase() === "true";

  if (wantCount) {
    const c = await Task.countDocuments(where);
    return res.status(200).json({ message: "OK", data: c });
  }

  let q = Task.find(where);
  if (sort)   q = q.sort(sort);
  if (select) q = q.select(select); 
  if (skip)   q = q.skip(skip);
  if (limit)  q = q.limit(limit);

  const tasks = await q.exec();
  return res.status(200).json({ message: "OK", data: tasks });
} catch {
  return res.status(400).json({ message: "Invalid query parameters", data: null });
}
});


router.get("/tasks/:id", async (req, res) => {
  const ok = (data, message = "OK", status = 200) =>
    res.status(status).json({ message, data });
  const error = (status, message, data = null) =>
    res.status(status).json({ message, data });

  const parseParam = (val) => {
    if (val == null) return null;
    if (typeof val === "object") return val;
    if (typeof val === "string") {
      try { return JSON.parse(val); } catch (_) {}
      try { return JSON.parse(val.replace(/'/g, '"')); } catch (_) {}
    }
    return null;
  };

  try {
    const select = parseParam(req.query.select) || null;
    const q = select ? Task.findById(req.params.id).select(select)
                     : Task.findById(req.params.id);
    const task = await q.exec();
    if (!task) return error(404, "Task not found");
    return ok(task);
  } catch {
    return error(400, "Invalid id or select");
  }
});

router.put("/tasks/:id", async (req, res) => {
  const ok = (data, message = "OK", status = 200) =>
    res.status(status).json({ message, data });
  const error = (status, message, data = null) =>
    res.status(status).json({ message, data });

  try {
    const prev = await Task.findById(req.params.id).lean();
    if (!prev) return error(404, "Task not found");

    const { name, description, deadline, completed, assignedUser, assignedUserName } = req.body || {};
    if (!name || !deadline) return error(400, "Task name and deadline are required");

    const dl = isFinite(+deadline) ? new Date(+deadline) : new Date(deadline);
    const isCompleted = String(completed).toLowerCase() === "true" || completed === true;

    let nextAssignedUser = "";
    let nextAssignedUserName = "unassigned";
    if (assignedUser && String(assignedUser).trim() !== "") {
      const u = await User.findById(String(assignedUser).trim());
      if (!u) return error(400, "assignedUser does not exist");
      nextAssignedUser = String(u._id);
      nextAssignedUserName =
        (assignedUserName && assignedUserName.trim()) ? assignedUserName.trim() : u.name;
    }

    const updates = {
      name: String(name).trim(),
      description: description ? String(description) : "",
      deadline: dl,
      completed: !!isCompleted,
      assignedUser: nextAssignedUser,
      assignedUserName: nextAssignedUserName
    };

    const saved = await Task.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    );

    const oldUser = prev.assignedUser || "";
    const oldWasPending = oldUser && !prev.completed;

    const newUser = saved.assignedUser || "";
    const newIsPending = newUser && !saved.completed;

    if (oldWasPending) {
      await User.updateOne(
        { _id: oldUser },
        { $pull: { pendingTasks: String(saved._id) } }
      );
    }

    if (newIsPending) {
      await User.updateOne(
        { _id: newUser },
        { $addToSet: { pendingTasks: String(saved._id) } }
      );
    }

    return ok(saved);
  } catch (e) {
    return error(500, "Server error");
  }
});

router.get("/users/:id", async (req, res) => {
  const ok = (data, message = "OK", status = 200) =>
    res.status(status).json({ message, data });
  const error = (status, message, data = null) =>
    res.status(status).json({ message, data });
  const parseJSON = (s) => { try { return JSON.parse(s); } catch { return null; } };

  try {
    const select = parseJSON(req.query.select) || null;
    const q = select ? User.findById(req.params.id).select(select)
                     : User.findById(req.params.id);
    const user = await q.exec();
    if (!user) return error(404, "User not found");
    return ok(user);
  } catch {
    return error(400, "Invalid id or select");
  }
});

router.put("/users/:id", async (req, res) => {
  const ok = (data, message = "OK", status = 200) =>
    res.status(status).json({ message, data });
  const error = (status, message, data = null) =>
    res.status(status).json({ message, data });

  try {
    const prev = await User.findById(req.params.id).lean();
    if (!prev) return error(404, "User not found");

    const { name, email, pendingTasks } = req.body || {};
    if (!name || !email) return error(400, "Name and email are required");

    const newName = String(name).trim();
    const newEmail = String(email).toLowerCase().trim();
    const newPending = Array.isArray(pendingTasks)
      ? Array.from(new Set(pendingTasks.map(String)))
      : [];

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { name: newName, email: newEmail, pendingTasks: newPending },
      { new: true, runValidators: true }
    );

    const oldPending = new Set((prev.pendingTasks || []).map(String));
    const newPendingSet = new Set(newPending);

    const toUnassign = [...oldPending].filter(id => !newPendingSet.has(id));
    const toAssign = [...newPendingSet].filter(id => !oldPending.has(id));

    if (toUnassign.length) {
      await Task.updateMany(
        { _id: { $in: toUnassign }, assignedUser: String(user._id), completed: false },
        { $set: { assignedUser: "", assignedUserName: "unassigned" } }
      );
    }

    if (toAssign.length) {
      await Task.updateMany(
        { _id: { $in: toAssign } },
        { $set: { assignedUser: String(user._id), assignedUserName: newName, completed: false } }
      );
    }

    return ok(user);
  } catch (err) {
    if (err && err.code === 11000) {
      return error(400, "A user with that email already exists");
    }
    return error(500, "Server error");
  }
});


  router.post("/tasks", async (req, res) => {
    try {
      let {
        name,
        description,
        deadline,
        completed,
        assignedUser,
        assignedUserName
      } = req.body || {};

      if (!name || !deadline) {
        return res.status(400).json({ message: "Task name and deadline are required", data: null });
      }

      const dl = isFinite(+deadline) ? new Date(+deadline) : new Date(deadline);
      const isCompleted = String(completed).toLowerCase() === "true";
      let finalAssignedUser = "";
      let finalAssignedUserName = "unassigned";

      if (assignedUser && String(assignedUser).trim() !== "") {
        const u = await User.findById(String(assignedUser).trim());
        if (!u) {
          return res.status(400).json({ message: "assignedUser does not exist", data: null });
        }
        finalAssignedUser = String(u._id);
        finalAssignedUserName = assignedUserName && assignedUserName.trim()
          ? assignedUserName.trim()
          : u.name;
      }

      const task = await Task.create({
        name: String(name).trim(),
        description: description ? String(description) : "",
        deadline: dl,
        completed: isCompleted,
        assignedUser: finalAssignedUser,
        assignedUserName: finalAssignedUserName
      });

      if (finalAssignedUser && !isCompleted) {
        await User.updateOne(
          { _id: finalAssignedUser },
          { $addToSet: { pendingTasks: String(task._id) } }
        );
      }

      return res.status(201).json({ message: "Created", data: task });
    } catch (e) {
      return res.status(500).json({ message: "Server error", data: null });
    }
  });

router.delete("/tasks/:id", async (req, res) => {
  const ok = (data, message = "OK", status = 200) =>
    res.status(status).json({ message, data });
  const error = (status, message, data = null) =>
    res.status(status).json({ message, data });

  try {

    const task = await Task.findById(req.params.id);
    if (!task) return error(404, "Task not found");

    const assignedUser = task.assignedUser || "";
    const wasPending = assignedUser && !task.completed;

    await Task.deleteOne({ _id: req.params.id });

    if (wasPending) {
      await User.updateOne(
        { _id: assignedUser },
        { $pull: { pendingTasks: String(task._id) } }
      );
    }

    return ok(null, "Deleted", 200);
  } catch {
    return error(500, "Server error");
  }
});

router.delete("/users/:id", async (req, res) => {
  const ok = (data, message = "OK", status = 200) =>
    res.status(status).json({ message, data });
  const error = (status, message, data = null) =>
    res.status(status).json({ message, data });

  try {
    const user = await User.findById(req.params.id);
    if (!user) return error(404, "User not found");

    await Task.updateMany(
      { assignedUser: String(user._id), completed: false },
      { $set: { assignedUser: "", assignedUserName: "unassigned" } }
    );

    await User.deleteOne({ _id: user._id });

    return ok(null, "Deleted", 200);
  } catch {
    return error(500, "Server error");
  }
});


  app.use("/api", router);
};
